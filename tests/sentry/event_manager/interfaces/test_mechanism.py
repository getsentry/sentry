# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.exception import (
    Mechanism,
    normalize_mechanism_meta,
    upgrade_legacy_mechanism)
from sentry.testutils import TestCase
from sentry.models import Event
from sentry.event_manager import EventManager


class MechanismTest(TestCase):
    @classmethod
    def to_python(cls, data):
        mgr = EventManager(data={
            "exception": {
                "values": [{"type": "FooError", "mechanism": data}]
            }
        })
        mgr.normalize()
        evt = Event(data=mgr.get_data())
        if evt.data.get('errors'):
            raise InterfaceValidationError(evt.data.get('errors'))
        exc = evt.interfaces['exception'].values[0]
        return exc.mechanism or Mechanism.to_python({})

    def test_path(self):
        inst = self.to_python({'type': 'generic'})
        assert inst.get_path() == 'mechanism'

    def test_empty_mechanism(self):
        data = {'type': 'generic'}
        assert self.to_python(data).to_json() == data

    def test_tag(self):
        data = {'type': 'generic'}
        inst = self.to_python(data)
        assert list(inst.iter_tags()) == [
            ('mechanism', 'generic')
        ]

    def test_tag_with_handled(self):
        data = {
            'type': 'generic',
            'handled': False,
        }

        inst = self.to_python(data)
        assert list(inst.iter_tags()) == [
            ('mechanism', 'generic'),
            ('handled', 'no')
        ]

    def test_data(self):
        data = {
            'type': 'generic',
            'data': {'relevant_address': '0x1'},
        }
        assert self.to_python(data).to_json() == data

    def test_empty_data(self):
        data = {
            'type': 'generic',
            'data': {},
        }

        assert self.to_python(data).to_json() == {
            'type': 'generic'
        }

    def test_min_mach_meta(self):
        input = {
            'type': 'generic',
            'meta': {
                'mach_exception': {
                    'exception': 10,
                    'code': 0,
                    'subcode': 0,
                }
            }
        }

        output = {
            'type': 'generic',
            'meta': {
                'mach_exception': {
                    'exception': 10,
                    'name': 'EXC_CRASH',
                    'code': 0,
                    'subcode': 0,
                }
            }
        }
        assert self.to_python(input).to_json() == output

    def test_full_mach_meta(self):
        data = {
            'type': 'generic',
            'meta': {
                'mach_exception': {
                    'exception': 10,
                    'code': 0,
                    'subcode': 0,
                    'name': 'EXC_CRASH'
                }
            }
        }
        assert self.to_python(data).to_json() == data

    def test_min_signal_meta(self):
        data = {
            'type': 'generic',
            'meta': {
                'signal': {
                    'number': 10,
                    'code': 0,
                }
            }
        }
        assert self.to_python(data).to_json() == data

    def test_full_signal_meta(self):
        data = {
            'type': 'generic',
            'meta': {
                'signal': {
                    'number': 10,
                    'code': 0,
                    'name': 'SIGBUS',
                    'code_name': 'BUS_NOOP',
                }
            }
        }
        assert self.to_python(data).to_json() == data

    def test_min_errno_meta(self):
        data = {
            'type': 'generic',
            'meta': {
                'errno': {
                    'number': 2,
                }
            }
        }
        assert self.to_python(data).to_json() == data

    def test_full_errno_meta(self):
        data = {
            'type': 'generic',
            'meta': {
                'errno': {
                    'number': 2,
                    'name': 'ENOENT',
                }
            }
        }
        assert self.to_python(data).to_json() == data

    def test_upgrade(self):
        data = {
            "posix_signal": {
                "name": "SIGSEGV",
                "code_name": "SEGV_NOOP",
                "signal": 11,
                "code": 0
            },
            "relevant_address": "0x1",
            "mach_exception": {
                "exception": 1,
                "exception_name": "EXC_BAD_ACCESS",
                "subcode": 8,
                "code": 1
            }
        }

        assert upgrade_legacy_mechanism(data) == {
            "type": "generic",
            "data": {
                "relevant_address": "0x1"
            },
            "meta": {
                "mach_exception": {
                    "exception": 1,
                    "subcode": 8,
                    "code": 1,
                    "name": "EXC_BAD_ACCESS"
                },
                "signal": {
                    "number": 11,
                    "code": 0,
                    "name": "SIGSEGV",
                    "code_name": "SEGV_NOOP"
                }
            }
        }

    def test_normalize_missing(self):
        data = {'type': 'generic'}
        normalize_mechanism_meta(data, None)
        assert data == {'type': 'generic'}

    def test_normalize_errno(self):
        data = {
            'type': 'generic',
            'meta': {
                'errno': {
                    'number': 2
                }
            }
        }

        normalize_mechanism_meta(data, {'sdk_name': 'linux'})
        assert data['meta']['errno'] == {
            'number': 2,
            'name': 'ENOENT'
        }

    def test_normalize_errno_override(self):
        data = {
            'type': 'generic',
            'meta': {
                'errno': {
                    'number': 2,
                    'name': 'OVERRIDDEN',
                }
            }
        }

        normalize_mechanism_meta(data, {'sdk_name': 'linux'})
        assert data['meta']['errno'] == {
            'number': 2,
            'name': 'OVERRIDDEN',
        }

    def test_normalize_errno_fail(self):
        data = {
            'type': 'generic',
            'meta': {
                'errno': {
                    'number': 2
                }
            }
        }

        normalize_mechanism_meta(data, {'sdk_name': 'invalid'})
        assert data['meta']['errno'] == {
            'number': 2,
        }

    def test_normalize_signal(self):
        data = {
            'type': 'generic',
            'meta': {
                'signal': {
                    'number': 11,
                    'code': 0,
                }
            }
        }

        normalize_mechanism_meta(data, {'sdk_name': 'macos'})
        assert data['meta']['signal'] == {
            'number': 11,
            'code': 0,
            'name': 'SIGSEGV',
            'code_name': 'SEGV_NOOP'
        }

    def test_normalize_partial_signal(self):
        data = {
            'type': 'generic',
            'meta': {
                'signal': {
                    'number': 11
                }
            }
        }

        normalize_mechanism_meta(data, {'sdk_name': 'linux'})
        assert data['meta']['signal'] == {
            'number': 11,
            'name': 'SIGSEGV',
        }

    def test_normalize_signal_override(self):
        data = {
            'type': 'generic',
            'meta': {
                'signal': {
                    'number': 11,
                    'code': 0,
                    'name': 'OVERRIDDEN',
                    'code_name': 'OVERRIDDEN',
                }
            }
        }

        normalize_mechanism_meta(data, {'sdk_name': 'macos'})
        assert data['meta']['signal'] == {
            'number': 11,
            'code': 0,
            'name': 'OVERRIDDEN',
            'code_name': 'OVERRIDDEN',
        }

    def test_normalize_signal_fail(self):
        data = {
            'type': 'generic',
            'meta': {
                'signal': {
                    'number': 11,
                    'code': 0,
                }
            }
        }

        normalize_mechanism_meta(data, {'sdk_name': 'invalid'})
        assert data['meta']['signal'] == {
            'number': 11,
            'code': 0,
        }

    def test_normalize_mach(self):
        data = {
            'type': 'generic',
            'meta': {
                'mach_exception': {
                    'exception': 1,
                    'subcode': 8,
                    'code': 1,
                }
            }
        }

        # We do not need SDK information here because mach exceptions only
        # occur on Darwin

        normalize_mechanism_meta(data, None)
        assert data['meta']['mach_exception'] == {
            'exception': 1,
            'subcode': 8,
            'code': 1,
            'name': 'EXC_BAD_ACCESS'
        }

    def test_normalize_mach_override(self):
        data = {
            'type': 'generic',
            'meta': {
                'mach_exception': {
                    'exception': 1,
                    'subcode': 8,
                    'code': 1,
                    'name': 'OVERRIDDEN',
                }
            }
        }

        # We do not need SDK information here because mach exceptions only
        # occur on Darwin

        normalize_mechanism_meta(data, None)
        assert data['meta']['mach_exception'] == {
            'exception': 1,
            'subcode': 8,
            'code': 1,
            'name': 'OVERRIDDEN'
        }

    def test_normalize_mach_fail(self):
        data = {
            'type': 'generic',
            'meta': {
                'mach_exception': {
                    'exception': 99,
                    'subcode': 8,
                    'code': 1,
                }
            }
        }

        # We do not need SDK information here because mach exceptions only
        # occur on Darwin

        normalize_mechanism_meta(data, None)
        assert data['meta']['mach_exception'] == {
            'exception': 99,
            'subcode': 8,
            'code': 1,
        }
