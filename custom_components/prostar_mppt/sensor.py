"""Sensor platform for ProStar MPPT."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import (
    CONF_HOST,
    CONF_NAME,
    CONF_PORT,
    UnitOfElectricCurrent,
    UnitOfElectricPotential,
    UnitOfPower,
)
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import ProstarMpptDataUpdateCoordinator


@dataclass(frozen=True, kw_only=True)
class ProstarMpptSensorEntityDescription(SensorEntityDescription):
    """ProStar MPPT sensor entity description."""

    value_fn: Callable[[dict[str, Any]], Any]


SENSOR_DESCRIPTIONS: tuple[ProstarMpptSensorEntityDescription, ...] = (
    ProstarMpptSensorEntityDescription(
        key="array_voltage",
        translation_key="array_voltage",
        name="Array Voltage",
        native_unit_of_measurement=UnitOfElectricPotential.VOLT,
        device_class=SensorDeviceClass.VOLTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: _as_float(data.get("arrayVoltage")),
    ),
    ProstarMpptSensorEntityDescription(
        key="array_current",
        translation_key="array_current",
        name="Array Current",
        native_unit_of_measurement=UnitOfElectricCurrent.AMPERE,
        device_class=SensorDeviceClass.CURRENT,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: _as_float(data.get("arrayCurrent")),
    ),
    ProstarMpptSensorEntityDescription(
        key="array_max_power",
        translation_key="array_max_power",
        name="Array Max Power",
        native_unit_of_measurement=UnitOfPower.WATT,
        device_class=SensorDeviceClass.POWER,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: _as_float(data.get("arrayMaxPower")),
    ),
    ProstarMpptSensorEntityDescription(
        key="battery_voltage",
        translation_key="battery_voltage",
        name="Battery Voltage",
        native_unit_of_measurement=UnitOfElectricPotential.VOLT,
        device_class=SensorDeviceClass.VOLTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: _as_float(data.get("batteryVoltage")),
    ),
    ProstarMpptSensorEntityDescription(
        key="charge_current",
        translation_key="charge_current",
        name="Charge Current",
        native_unit_of_measurement=UnitOfElectricCurrent.AMPERE,
        device_class=SensorDeviceClass.CURRENT,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: _as_float(data.get("chargeCurrent")),
    ),
    ProstarMpptSensorEntityDescription(
        key="target_voltage",
        translation_key="target_voltage",
        name="Target Voltage",
        native_unit_of_measurement=UnitOfElectricPotential.VOLT,
        device_class=SensorDeviceClass.VOLTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: _as_float(data.get("targetVoltage")),
    ),
    ProstarMpptSensorEntityDescription(
        key="power_out",
        translation_key="power_out",
        name="Power Out",
        native_unit_of_measurement=UnitOfPower.WATT,
        device_class=SensorDeviceClass.POWER,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda data: _as_float(data.get("powerOut")),
    ),
    ProstarMpptSensorEntityDescription(
        key="charge_state",
        translation_key="charge_state",
        name="Charge State",
        device_class=SensorDeviceClass.ENUM,
        options=(
            "START",
            "NIGHT_CHECK",
            "DISCONNECT",
            "NIGHT",
            "FAULT",
            "MPPT",
            "ABSORPTION",
            "FLOAT",
            "EQUALIZE",
            "SLAVE",
            "FIXED",
            "UNKNOWN",
        ),
        value_fn=lambda data: data.get("chargeStateName", "UNKNOWN"),
    ),
)


def _as_float(value: Any) -> float | None:
    """Convert value to float when possible."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up ProStar MPPT sensors from a config entry."""
    coordinator: ProstarMpptDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    device_identifier = f"{entry.data[CONF_HOST]}:{entry.data[CONF_PORT]}"

    entities = [
        ProstarMpptSensor(coordinator, entry, description, device_identifier)
        for description in SENSOR_DESCRIPTIONS
    ]
    async_add_entities(entities)


class ProstarMpptSensor(CoordinatorEntity[ProstarMpptDataUpdateCoordinator], SensorEntity):
    """Representation of a ProStar MPPT sensor."""

    entity_description: ProstarMpptSensorEntityDescription

    def __init__(
        self,
        coordinator: ProstarMpptDataUpdateCoordinator,
        entry: ConfigEntry,
        description: ProstarMpptSensorEntityDescription,
        device_identifier: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self.entity_description = description
        self._attr_has_entity_name = True
        self._attr_unique_id = f"{device_identifier}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, device_identifier)},
            manufacturer="Morningstar",
            model="ProStar MPPT",
            name=entry.data[CONF_NAME],
        )

    @property
    def native_value(self) -> Any:
        """Return state from coordinator data."""
        if not self.coordinator.data:
            return None
        return self.entity_description.value_fn(self.coordinator.data)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Expose metadata attributes on the charge state sensor."""
        if self.entity_description.key != "charge_state" or not self.coordinator.data:
            return None

        return {
            "charge_state_code": self.coordinator.data.get("chargeState"),
            "protocol": self.coordinator.data.get("protocol"),
            "poll_count": self.coordinator.data.get("pollCount"),
            "updated_at": self.coordinator.data.get("updatedAt"),
        }
