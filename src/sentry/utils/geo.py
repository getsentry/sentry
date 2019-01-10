from __future__ import absolute_import

import logging

from django.conf import settings


logger = logging.getLogger(__name__)


# default is no-op
def geo_by_addr(ip):
    pass


rust_geoip = None


def _init_geoip():
    global geo_by_addr
    try:
        import GeoIP
    except ImportError:
        logger.warning("GeoIP module not available.")
        return

    geoip_path = getattr(settings, 'GEOIP_PATH', None)
    if not geoip_path:
        logger.warning("settings.GEOIP_PATH not configured.")
        return

    try:
        geo_db = GeoIP.open(geoip_path, GeoIP.GEOIP_MEMORY_CACHE)
    except Exception:
        logger.warning("Error opening GeoIP database: %s" % geoip_path)
        return

    geo_by_addr = geo_db.record_by_addr


def _init_geoip_rust():
    global rust_geoip

    geoip_path_mmdb = getattr(settings, 'GEOIP_PATH_MMDB', None)

    if not geoip_path_mmdb:
        logger.warning("No GeoIP MMDB database configured")
        return

    from semaphore.processing import GeoIpLookup

    try:
        rust_geoip = GeoIpLookup.from_path(geoip_path_mmdb)
    except Exception:
        logger.warning("Error opening GeoIP database in Rust: %s" % geoip_path_mmdb)


_init_geoip()
_init_geoip_rust()
