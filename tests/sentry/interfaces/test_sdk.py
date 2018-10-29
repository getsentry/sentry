# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.sdk import Sdk
from sentry.testutils import TestCase


class SdkTest(TestCase):
    def test_serialize_behavior(self):
        assert Sdk.to_python({
            'name': 'sentry-java',
            'version': '1.0',
            'integrations': ['log4j'],
            'packages': [{
                'name': 'maven:io.sentry.sentry',
                'version': '1.7.10',
            }],
        }).to_json() == {
            'name': 'sentry-java',
            'version': '1.0',
            'integrations': ['log4j'],
            'packages': [{
                'name': 'maven:io.sentry.sentry',
                'version': '1.7.10',
            }],
        }

    def test_null_values(self):
        sink = {}
        assert Sdk.to_python({}).to_json() == sink
        assert Sdk.to_python({'name': None}).to_json() == sink
        assert Sdk.to_python({'integrations': []}).to_json() == sink
        assert Sdk.to_python({'packages': None}).to_json() == sink
        assert Sdk.to_python({'packages': [None]}).to_json() == {"packages": [None]}

    def test_missing_name(self):
        assert Sdk.to_python({
            'version': '1.0',
        }).to_json() == {
            'version': '1.0',
        }

    def test_missing_version(self):
        assert Sdk.to_python({
            'name': 'sentry-unity',
        }).to_json() == {
            'name': 'sentry-unity',
        }

    def test_path(self):
        assert Sdk().get_path() == 'sdk'
