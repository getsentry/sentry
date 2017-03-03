# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.sdk import Sdk
from sentry.testutils import TestCase


class SdkTest(TestCase):
    def test_serialize_behavior(self):
        assert Sdk.to_python({
            'name': 'sentry-unity',
            'version': '1.0',
        }).to_json() == {
            'name': 'sentry-unity',
            'version': '1.0',
        }

    def test_missing_name(self):
        with pytest.raises(InterfaceValidationError):
            assert Sdk.to_python({
                'version': '1.0',
            })

    def test_missing_version(self):
        with pytest.raises(InterfaceValidationError):
            assert Sdk.to_python({
                'name': 'sentry-unity',
            })

    def test_path(self):
        assert Sdk().get_path() == 'sdk'
