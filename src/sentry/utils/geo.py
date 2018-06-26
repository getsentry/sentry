from __future__ import absolute_import

import logging

from django.conf import settings


logger = logging.getLogger(__name__)


# default is no-op
geo_by_addr = lambda ip: None

try:
    import GeoIP
except ImportError:
    logger.warning("GeoIP module not available.")
else:
    geoip_path = getattr(settings, 'GEOIP_PATH', None)
    if geoip_path:
        try:
            geo_db = GeoIP.open(geoip_path, GeoIP.GEOIP_MEMORY_CACHE)
        except Exception:
            logger.warning("Error opening GeoIP database: %s" % geoip_path)
        else:
            geo_by_addr = geo_db.record_by_addr
    else:
        logger.warning("settings.GEOIP_PATH not configured.")
