# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.exception import (SingleException, Exception, slim_exception_data,
                                         Mechanism, normalize_mechanism_meta, upgrade_legacy_mechanism)
from sentry.testutils import TestCase
from sentry.stacktraces import normalize_in_app


class ExceptionTest(TestCase):
    @fixture
    def interface(self):
        return Exception.to_python(
            dict(
                values=[
                    {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [{
                                'filename': 'foo/baz.py',
                                'lineno': 1,
                                'in_app': True,
                            }]
                        },
                    }, {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [{
                                'filename': 'foo/baz.py',
                                'lineno': 1,
                                'in_app': True,
                            }]
                        },
                    }
                ]
            )
        )

    def test_path(self):
        assert self.interface.get_path() == 'sentry.interfaces.Exception'

    def test_args_as_keyword_args(self):
        inst = Exception.to_python(
            dict(values=[{
                'type': 'ValueError',
                'value': 'hello world',
                'module': 'foo.bar',
            }])
        )
        assert type(inst.values[0]) is SingleException
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_args_as_old_style(self):
        inst = Exception.to_python(
            {
                'type': 'ValueError',
                'value': 'hello world',
                'module': 'foo.bar',
            }
        )
        assert type(inst.values[0]) is SingleException
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_non_string_value_with_no_type(self):
        inst = Exception.to_python(
            {
                'value': {'foo': 'bar'},
            }
        )
        assert inst.values[0].value == '{"foo":"bar"}'

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_to_string(self):
        result = self.interface.to_string(self.event)
        assert result == """ValueError: hello world
  File "foo/baz.py", line 1

ValueError: hello world
  File "foo/baz.py", line 1"""

    def test_get_hash(self):
        inst = self.interface

        all_values = sum([v.get_hash() for v in inst.values], [])
        assert inst.get_hash() == all_values

    def test_context_with_mixed_frames(self):
        inst = Exception.to_python(
            dict(
                values=[
                    {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [{
                                'filename': 'foo/baz.py',
                                'lineno': 1,
                                'in_app': True,
                            }]
                        },
                    }, {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [{
                                'filename': 'foo/baz.py',
                                'lineno': 1,
                                'in_app': False,
                            }]
                        },
                    }
                ]
            )
        )

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['hasSystemFrames']

    def test_context_with_symbols(self):
        inst = Exception.to_python(
            dict(
                values=[
                    {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [
                                {
                                    'filename': 'foo/baz.py',
                                    'function': 'myfunc',
                                    'symbol': 'Class.myfunc',
                                    'lineno': 1,
                                    'in_app': True,
                                }
                            ]
                        },
                    }
                ]
            )
        )

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['stacktrace']['frames'][0]['symbol'] == 'Class.myfunc'

    def test_context_with_only_system_frames(self):
        inst = Exception.to_python(
            dict(
                values=[
                    {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [{
                                'filename': 'foo/baz.py',
                                'lineno': 1,
                                'in_app': False,
                            }]
                        },
                    }, {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [{
                                'filename': 'foo/baz.py',
                                'lineno': 1,
                                'in_app': False,
                            }]
                        },
                    }
                ]
            )
        )

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert not context['hasSystemFrames']

    def test_context_with_only_app_frames(self):
        values = [
            {
                'type': 'ValueError',
                'value': 'hello world',
                'module': 'foo.bar',
                'stacktrace': {
                    'frames': [{
                        'filename': 'foo/baz.py',
                        'lineno': 1,
                        'in_app': True,
                    }]
                },
            }, {
                'type': 'ValueError',
                'value': 'hello world',
                'module': 'foo.bar',
                'stacktrace': {
                    'frames': [{
                        'filename': 'foo/baz.py',
                        'lineno': 1,
                        'in_app': True,
                    }]
                },
            }
        ]
        exc = dict(values=values)
        normalize_in_app({'sentry.interfaces.Exception': exc})
        inst = Exception.to_python(exc)

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert not context['hasSystemFrames']

    def test_context_with_raw_stacks(self):
        inst = Exception.to_python(
            dict(
                values=[
                    {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foobar',
                        'raw_stacktrace': {
                            'frames': [
                                {
                                    'filename': None,
                                    'lineno': 1,
                                    'function': '<redacted>',
                                    'in_app': True,
                                }
                            ]
                        },
                        'stacktrace': {
                            'frames': [
                                {
                                    'filename': 'foo/baz.c',
                                    'lineno': 1,
                                    'function': 'main',
                                    'in_app': True,
                                }
                            ]
                        },
                    }
                ]
            )
        )

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['stacktrace']['frames'][0]['function'] == 'main'
        assert context['values'][0]['rawStacktrace']['frames'][0]['function'] == '<redacted>'

    def test_context_with_mechanism(self):
        inst = Exception.to_python(
            dict(
                values=[
                    {
                        'type': 'ValueError',
                        'value': 'hello world',
                        'module': 'foo.bar',
                        'stacktrace': {
                            'frames': [{
                                'filename': 'foo/baz.py',
                                'lineno': 1,
                                'in_app': True,
                            }]
                        },
                        'mechanism': {
                            'type': 'generic',
                        }
                    }
                ]
            )
        )

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['mechanism']['type'] == 'generic'


class SingleExceptionTest(TestCase):
    @fixture
    def interface(self):
        return SingleException.to_python(
            dict(
                type='ValueError',
                value='hello world',
                module='foo.bar',
            )
        )

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'type': self.interface.type,
            'value': self.interface.value,
            'module': self.interface.module,
            'thread_id': None,
            'mechanism': None,
            'stacktrace': None,
            'raw_stacktrace': None,
        }

    def test_get_hash(self):
        assert self.interface.get_hash() == [
            self.interface.type,
            self.interface.value,
        ]

    def test_get_hash_without_type(self):
        self.interface.type = None
        assert self.interface.get_hash() == [
            self.interface.value,
        ]

    def test_get_hash_without_value(self):
        self.interface.value = None
        assert self.interface.get_hash() == [
            self.interface.type,
        ]

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_only_requires_only_type_or_value(self):
        SingleException.to_python(dict(
            type='ValueError',
        ))
        SingleException.to_python(dict(
            value='ValueError',
        ))

    def test_throws_away_empty_stacktrace(self):
        result = SingleException.to_python(
            dict(
                type='ValueError',
                value='foo',
                stacktrace={'frames': []},
            )
        )
        assert not result.stacktrace

    def test_coerces_object_value_to_string(self):
        result = SingleException.to_python({
            'type': 'ValueError',
            'value': {'unauthorized': True},
        })
        assert result.value == '{"unauthorized":true}'

    def test_handles_type_in_value(self):
        result = SingleException.to_python(dict(
            value='ValueError: unauthorized',
        ))
        assert result.type == 'ValueError'
        assert result.value == 'unauthorized'

        result = SingleException.to_python(dict(
            value='ValueError:unauthorized',
        ))
        assert result.type == 'ValueError'
        assert result.value == 'unauthorized'

    def test_value_serialization_idempotent(self):
        result = SingleException.to_python({
            'type': None,
            'value': {'unauthorized': True},
        }).to_json()

        assert result['type'] is None
        assert result['value'] == '{"unauthorized":true}'

        # Don't re-split a json-serialized value on the colon
        result = SingleException.to_python(result).to_json()
        assert result['type'] is None
        assert result['value'] == '{"unauthorized":true}'


class SlimExceptionDataTest(TestCase):
    def test_under_max(self):
        interface = Exception.to_python(
            {
                'values': [{
                    'value': 'foo',
                    'stacktrace': {
                        'frames': [{
                            'filename': 'foo'
                        }]
                    },
                }]
            }
        )
        slim_exception_data(interface)
        assert len(interface.values[0].stacktrace.frames) == 1

    def test_over_max(self):
        values = []
        for x in range(5):
            exc = {'value': 'exc %d' % x, 'stacktrace': {'frames': []}}
            values.append(exc)
            for y in range(5):
                exc['stacktrace']['frames'].append(
                    {
                        'filename': 'exc %d frame %d' % (x, y),
                        'vars': {
                            'foo': 'bar'
                        },
                        'context_line': 'b',
                        'pre_context': ['a'],
                        'post_context': ['c'],
                    }
                )

        interface = Exception.to_python({'values': values})

        # slim to 10 frames to make tests easier
        slim_exception_data(interface, 10)

        assert len(interface.values) == 5
        for e_num, value in enumerate(interface.values):
            assert value.value == 'exc %d' % e_num
            assert len(value.stacktrace.frames) == 5
            for f_num, frame in enumerate(value.stacktrace.frames):
                assert frame.filename == 'exc %d frame %d' % (e_num, f_num)
                if e_num in (0, 4):
                    assert frame.vars is not None
                    assert frame.pre_context is not None
                    assert frame.post_context is not None
                else:
                    assert frame.vars is None
                    assert frame.pre_context is None
                    assert frame.post_context is None


class MechanismTest(TestCase):
    def test_path(self):
        inst = Mechanism.to_python({'type': 'generic'})
        assert inst.get_path() == 'mechanism'

    def test_empty_mechanism(self):
        data = {'type': 'generic'}
        assert Mechanism.to_python(data).to_json() == data

    def test_tag(self):
        data = {'type': 'generic'}
        inst = Mechanism.to_python(data)
        assert list(inst.iter_tags()) == [
            ('mechanism', 'generic')
        ]

    def test_tag_with_handled(self):
        data = {
            'type': 'generic',
            'handled': False,
        }

        inst = Mechanism.to_python(data)
        assert list(inst.iter_tags()) == [
            ('mechanism', 'generic'),
            ('handled', 'no')
        ]

    def test_data(self):
        data = {
            'type': 'generic',
            'data': {'relevant_address': '0x1'},
        }
        assert Mechanism.to_python(data).to_json() == data

    def test_empty_data(self):
        data = {
            'type': 'generic',
            'data': {},
        }

        assert Mechanism.to_python(data).to_json() == {
            'type': 'generic'
        }

    def test_min_mach_meta(self):
        data = {
            'type': 'generic',
            'meta': {
                'mach_exception': {
                    'exception': 10,
                    'code': 0,
                    'subcode': 0,
                }
            }
        }
        assert Mechanism.to_python(data).to_json() == data

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
        assert Mechanism.to_python(data).to_json() == data

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
        assert Mechanism.to_python(data).to_json() == data

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
        assert Mechanism.to_python(data).to_json() == data

    def test_min_errno_meta(self):
        data = {
            'type': 'generic',
            'meta': {
                'errno': {
                    'number': 2,
                }
            }
        }
        assert Mechanism.to_python(data).to_json() == data

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
        assert Mechanism.to_python(data).to_json() == data

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
