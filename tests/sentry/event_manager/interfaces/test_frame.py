# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest

from sentry.interfaces.base import InterfaceValidationError
from sentry.event_manager import EventManager
from sentry.models import Event
from sentry.testutils import TestCase


class FrameTest(TestCase):
    @classmethod
    def to_python(cls, data):
        mgr = EventManager(data={"stacktrace": {"frames": [data]}})
        mgr.normalize()
        evt = Event(data=mgr.get_data())
        if evt.data.get('errors'):
            raise InterfaceValidationError(evt.data.get('errors'))

        return evt.interfaces['stacktrace'].frames[0]

    def test_bad_input(self):
        with pytest.raises(InterfaceValidationError):
            self.to_python({'filename': 1})

        assert self.to_python({'filename': 'foo', 'abs_path': 1}).abs_path == 'foo'

        with pytest.raises(InterfaceValidationError):
            self.to_python({'function': 1})

        with pytest.raises(InterfaceValidationError):
            self.to_python({'module': 1})

        assert self.to_python({'function': '?'}).function is None

    def test_context_with_nan(self):
        assert self.to_python({
            'filename': 'x',
            'vars': {
                'x': float('inf')
            },
        }).vars == {'x': 0}

        assert self.to_python({
            'filename': 'x',
            'vars': {
                'x': float('-inf')
            },
        }).vars == {'x': 0}

        assert self.to_python({
            'filename': 'x',
            'vars': {
                'x': float('nan')
            },
        }).vars == {'x': 0}

    def test_address_normalization(self):
        interface = self.to_python(
            {
                'lineno': 1,
                'filename': 'blah.c',
                'function': 'main',
                'instruction_addr': 123456,
                'symbol_addr': '123450',
                'image_addr': '0x0',
            }
        )
        assert interface.instruction_addr == '0x1e240'
        assert interface.symbol_addr == '0x1e23a'
        assert interface.image_addr == '0x0'
