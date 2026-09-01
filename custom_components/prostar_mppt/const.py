"""Constants for the ProStar MPPT integration."""

from __future__ import annotations

from datetime import timedelta

DOMAIN = "prostar_mppt"

CONF_SCAN_INTERVAL = "scan_interval"
CONF_USE_SSL = "use_ssl"

DEFAULT_NAME = "ProStar MPPT"
DEFAULT_HOST = "192.168.0.158"
DEFAULT_PORT = 9001
DEFAULT_USE_SSL = False
DEFAULT_SCAN_INTERVAL = 10

MIN_SCAN_INTERVAL = 2
MAX_SCAN_INTERVAL = 300

DEFAULT_TIMEOUT_SECONDS = 10

COORDINATOR_NAME = "ProStar MPPT Data Coordinator"

CHARGE_STATE_MAP: dict[int, str] = {
    0: "START",
    1: "NIGHT_CHECK",
    2: "DISCONNECT",
    3: "NIGHT",
    4: "FAULT",
    5: "MPPT",
    6: "ABSORPTION",
    7: "FLOAT",
    8: "EQUALIZE",
    9: "SLAVE",
    10: "FIXED",
}

UPDATE_INTERVAL_DEFAULT = timedelta(seconds=DEFAULT_SCAN_INTERVAL)
