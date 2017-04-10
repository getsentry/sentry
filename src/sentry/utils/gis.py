
from __future__ import absolute_import

import logging
import pygeoip

from sentry import options

gi = -1


def get_geocoder():
    try:
        return pygeoip.GeoIP(options.get('system.geoip-path'), pygeoip.MEMORY_CACHE)
    except Exception:
        logging.warn('Unable to load libgeoip at %s', options.get('system.geoip-path'),
                     exc_info=True)


def geocode(ip_address):
    global gi
    if gi is -1:
        gi = get_geocoder()
    if gi is None:
        return
    result = gi.record_by_addr(ip_address)
    if not result:
        return
    if not result['city']:
        return ''
    return {
        'lat': round(result['latitude'], 4),
        'lng': round(result['longitude'], 4),
        'country': result['country_code'],
        'city': result['city'],
        'region': result['region_code'] or '',
    }
