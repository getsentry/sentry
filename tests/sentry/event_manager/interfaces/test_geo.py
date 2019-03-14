from __future__ import absolute_import

import pytest

import mock

from sentry.interfaces.geo import Geo
from sentry.models import Event
from sentry.event_manager import EventManager


@pytest.fixture
def make_geo_snapshot(insta_snapshot):
    def inner(data):
        mgr = EventManager(data={"user": {"id": "123", "geo": data}})
        mgr.normalize()
        evt = Event(data=mgr.get_data())

        interface = evt.interfaces['user'].geo
        insta_snapshot({
            'errors': evt.data.get('errors'),
            'to_json': interface and interface.to_json()
        })

    return inner


def test_serialize_behavior(make_geo_snapshot):
    make_geo_snapshot({
        'country_code': 'US',
        'city': 'San Francisco',
        'region': 'CA',
    })


@pytest.mark.parametrize('input', [
    {},
    {"country_code": None},
    {"city": None},
    {"region": None},
])
def test_null_values(make_geo_snapshot, input):
    make_geo_snapshot(input)


@mock.patch('sentry.interfaces.geo.geo_by_addr')
def test_from_ip_address(geo_by_addr_mock):
    geo_by_addr_mock.return_value = {
        'area_code': 415,
        'city': 'San Francisco',
        'country_code': 'US',
        'country_code3': 'USA',
        'country_name': 'United States',
        'dma_code': 807,
        'latitude': 37.79570007324219,
        'longitude': -122.4208984375,
        'metro_code': 807,
        'postal_code': '94109',
        'region': 'CA',
        'region_name': 'California',
        'time_zone': 'America/Los_Angeles'
    }

    assert Geo.from_ip_address('192.168.0.1').to_json() == {
        'country_code': 'US',
        'city': 'San Francisco',
        'region': 'CA',
    }


@mock.patch('sentry.interfaces.geo.geo_by_addr')
def test_iso_8859_1_country_code(geo_by_addr_mock):
    # https://github.com/maxmind/geoip-api-python/releases/tag/v1.3.2
    # Previously GeoIP.country_names was populated from GeoIP_country_name in
    # the libGeoIP C API. Some versions of the libGeoIP include non-ASCII
    # ISO-8859-1 characters in these names, causing encoding errors under Python

    geo_by_addr_mock.return_value = {
        'city': 'San Francisco',
        'country_code': '\xc5lborg',
        'region': 'CA',
    }

    assert Geo.from_ip_address('192.168.0.1').to_json() == {
        'city': u'San Francisco',
        'country_code': u'\xc5lborg',
        'region': u'CA'
    }
