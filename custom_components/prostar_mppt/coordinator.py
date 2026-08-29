"""Data update coordinator for ProStar MPPT."""

from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import ProstarMpptApiClient, ProstarMpptApiError
from .const import (
    CONF_SCAN_INTERVAL,
    COORDINATOR_NAME,
    DEFAULT_SCAN_INTERVAL,
)

_LOGGER = logging.getLogger(__name__)


class ProstarMpptDataUpdateCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Coordinator for fetching ProStar telemetry."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        api: ProstarMpptApiClient,
    ) -> None:
        """Initialize coordinator."""
        scan_interval = entry.options.get(
            CONF_SCAN_INTERVAL,
            entry.data.get(CONF_SCAN_INTERVAL, DEFAULT_SCAN_INTERVAL),
        )

        super().__init__(
            hass,
            logger=_LOGGER,
            name=COORDINATOR_NAME,
            update_interval=timedelta(seconds=int(scan_interval)),
        )
        self.entry = entry
        self.api = api

    async def _async_update_data(self) -> dict[str, Any]:
        """Fetch data from ProStar MPPT endpoint."""
        try:
            return await self.api.async_get_status()
        except ProstarMpptApiError as err:
            raise UpdateFailed(str(err)) from err
