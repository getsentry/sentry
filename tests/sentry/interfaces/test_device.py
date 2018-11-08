# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.device import Device
from sentry.testutils import TestCase


class DeviceTest(TestCase):
    def test_serialize_behavior(self):
        assert Device.to_python({
            'name': 'Windows',
            'version': '95',
        }).to_json() == {
            'name': 'Windows',
            'version': '95',
        }

    def test_null_values(self):
        sink = {}

        assert Device.to_python({}).to_json() == sink
        assert Device.to_python({'name': None}).to_json() == sink

    def test_missing_name(self):
        assert Device.to_python({
            'version': '95',
        }).to_json() == {
            'version': '95',
        }

    def test_missing_version(self):
        assert Device.to_python({
            'name': 'Windows',
        }).to_json() == {
            'name': 'Windows',
        }

    def test_path(self):
        assert Device().get_path() == 'device'
