from __future__ import absolute_import

import mock

from sentry.interfaces.geo import Geo
from sentry.testutils import TestCase


class GeoTest(TestCase):
    def test_serialize_behavior(self):
        assert Geo.to_python({
            'country_code': 'US',
            'city': 'San Francisco',
            'region': 'CA',
        }).to_json() == {
            'country_code': 'US',
            'city': 'San Francisco',
            'region': 'CA',
        }

    @mock.patch('sentry.interfaces.geo.geo_by_addr')
    def test_from_ip_address(self, geo_by_addr_mock):
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

    def test_path(self):
        assert Geo().get_path() == 'geo'
