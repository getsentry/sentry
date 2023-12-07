from __future__ import annotations

import logging
from typing import Any

from django.conf import settings

logger = logging.getLogger(__name__)
geoip_path_mmdb = getattr(settings, "GEOIP_PATH_MMDB", None)


# default is no-op
def geo_by_addr(ip):
    pass


rust_geoip = None


def _init_geoip() -> None:
    global geo_by_addr
    try:
        import maxminddb
    except ImportError:
        logger.warning("maxminddb module not available.")
        return

    if geoip_path_mmdb is None:
        return

    try:
        geo_db = maxminddb.open_database(geoip_path_mmdb, maxminddb.MODE_AUTO)
    except Exception:
        logger.warning("Error opening GeoIP database: %s", geoip_path_mmdb)
        return

    def _geo_by_addr(ip: str) -> dict[str, Any] | None:
        rv = geo_db.get(ip)
        if not rv:
            return None

        assert isinstance(rv, dict)
        geo: dict[str, Any] = rv
        return {
            "country_code": geo["country"]["iso_code"],
            "region": geo.get("subdivisions", [{}])[-1].get("iso_code"),
            "city": geo.get("city", {}).get("names", {}).get("en"),
            "latitude": geo["location"]["latitude"],
            "longitude": geo["location"]["longitude"],
        }

    geo_by_addr = _geo_by_addr


def _init_geoip_rust():
    global rust_geoip

    from sentry_relay.processing import GeoIpLookup

    try:
        rust_geoip = GeoIpLookup.from_path(geoip_path_mmdb)
    except Exception:
        logger.warning("Error opening GeoIP database in Rust: %s", geoip_path_mmdb)


if geoip_path_mmdb:
    _init_geoip()
    _init_geoip_rust()
