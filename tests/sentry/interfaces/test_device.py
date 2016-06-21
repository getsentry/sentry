# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.interfaces.base import InterfaceValidationError
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

    def test_missing_name(self):
        with pytest.raises(InterfaceValidationError):
            assert Device.to_python({
                'version': '95',
            })

    def test_missing_version(self):
        with pytest.raises(InterfaceValidationError):
            assert Device.to_python({
                'name': 'Windows',
            })

    def test_path(self):
        assert Device().get_path() == 'device'
