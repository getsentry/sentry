from __future__ import absolute_import

import logging
import six

from django.conf import settings


logger = logging.getLogger(__name__)
geoip_path_mmdb = getattr(settings, "GEOIP_PATH_MMDB", None)


# default is no-op
def geo_by_addr(ip):
    pass


rust_geoip = None


def _init_geoip():
    global geo_by_addr
    try:
        import maxminddb
    except ImportError:
        logger.warning("maxminddb module not available.")
        return

    try:
        geo_db = maxminddb.open_database(geoip_path_mmdb, maxminddb.MODE_AUTO)
    except Exception:
        logger.warning("Error opening GeoIP database: %s" % geoip_path_mmdb)
        return

    def encode_bytes(data):
        if isinstance(data, six.text_type):
            return data.encode("ISO-8859-1")
        return data

    def _geo_by_addr(ip):
        geo = geo_db.get(ip)
        if not geo:
            return

        return {
            "country_code": encode_bytes(geo["country"]["iso_code"]),
            "region": encode_bytes(geo.get("subdivisions", [{}])[-1].get("iso_code")),
            "city": encode_bytes(geo.get("city", {}).get("names", {}).get("en")),
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
        logger.warning("Error opening GeoIP database in Rust: %s" % geoip_path_mmdb)


if geoip_path_mmdb:
    _init_geoip()
    _init_geoip_rust()
else:
    logger.warning("settings.GEOIP_PATH_MMDB not configured.")
