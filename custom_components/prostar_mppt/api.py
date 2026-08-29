"""API client for the ProStar MPPT server."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from aiohttp import ClientError, ClientSession

from .const import CHARGE_STATE_MAP, DEFAULT_TIMEOUT_SECONDS


class ProstarMpptApiError(Exception):
    """Raised when the ProStar MPPT API returns an error."""


@dataclass(slots=True)
class ProstarMpptApiClient:
    """Simple client for the ProStar MPPT JSON API."""

    session: ClientSession
    host: str
    port: int
    use_ssl: bool = False

    @property
    def base_url(self) -> str:
        """Return base URL for the configured host."""
        scheme = "https" if self.use_ssl else "http"
        return f"{scheme}://{self.host}:{self.port}"

    async def async_get_status(self) -> dict[str, Any]:
        """Get latest status from the Node server."""
        url = f"{self.base_url}/api/status"

        try:
            async with self.session.get(url, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
                if response.status >= 400:
                    text = await response.text()
                    raise ProstarMpptApiError(
                        f"Status endpoint returned HTTP {response.status}: {text}"
                    )

                payload = await response.json()
        except (ClientError, TimeoutError) as err:
            raise ProstarMpptApiError(f"Failed to reach ProStar server: {err}") from err

        if not isinstance(payload, dict):
            raise ProstarMpptApiError("Invalid payload: expected a JSON object")

        data = payload.get("data")
        if not isinstance(data, dict):
            raise ProstarMpptApiError("Invalid payload: missing 'data' object")

        telemetry = dict(data)
        charge_state_raw = telemetry.get("chargeState")
        if isinstance(charge_state_raw, (int, float)):
            charge_state = int(charge_state_raw)
            telemetry["chargeState"] = charge_state
            telemetry["chargeStateName"] = CHARGE_STATE_MAP.get(charge_state, "UNKNOWN")

        telemetry["protocol"] = payload.get("protocol")
        telemetry["pollCount"] = payload.get("pollCount")
        telemetry["updatedAt"] = payload.get("updatedAt")
        return telemetry

    async def async_get_health(self) -> dict[str, Any]:
        """Check server health endpoint availability."""
        url = f"{self.base_url}/api/health"

        try:
            async with self.session.get(url, timeout=DEFAULT_TIMEOUT_SECONDS) as response:
                if response.status >= 400:
                    text = await response.text()
                    raise ProstarMpptApiError(
                        f"Health endpoint returned HTTP {response.status}: {text}"
                    )
                payload = await response.json()
        except (ClientError, TimeoutError) as err:
            raise ProstarMpptApiError(f"Failed to reach ProStar server: {err}") from err

        if not isinstance(payload, dict):
            raise ProstarMpptApiError("Invalid health payload: expected a JSON object")
        return payload
