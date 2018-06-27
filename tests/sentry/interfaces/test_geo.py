from __future__ import absolute_import

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

    def test_path(self):
        assert Geo().get_path() == 'geo'
