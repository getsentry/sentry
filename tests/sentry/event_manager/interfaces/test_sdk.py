# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.sdk import Sdk
from sentry.testutils import TestCase
from sentry.models import Event
from sentry.event_manager import EventManager


def to_python(data):
    mgr = EventManager(data={"sdk": data})
    mgr.normalize()
    evt = Event(data=mgr.get_data())
    if evt.data.get('errors'):
        raise InterfaceValidationError(evt.data.get('errors'))
    return evt.interfaces.get('sdk') or Sdk.to_python({})


class SdkTest(TestCase):
    def test_serialize_behavior(self):
        assert to_python({
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

    def test_missing_name(self):
        with pytest.raises(InterfaceValidationError):
            to_python({'version': '1.0'})

    def test_missing_version(self):
        with pytest.raises(InterfaceValidationError):
            to_python({'name': 'sentry-unity'})

    def test_path(self):
        assert Sdk().get_path() == 'sdk'
