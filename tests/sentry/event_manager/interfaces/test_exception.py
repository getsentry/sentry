# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.base import InterfaceValidationError
from sentry.interfaces.exception import Exception, SingleException, slim_exception_data
from sentry.testutils import TestCase
from sentry.stacktraces import normalize_in_app
from sentry.models import Event
from sentry.event_manager import EventManager


class ExceptionTest(TestCase):
    @classmethod
    def to_python(cls, data):
        mgr = EventManager(data={"exception": data})
        mgr.normalize()
        evt = Event(data=mgr.get_data())
        if evt.data.get('errors'):
            raise InterfaceValidationError(evt.data.get('errors'))

        return evt.interfaces.get('exception') or Exception.to_python({})

    @fixture
    def interface(self):
        return self.to_python(
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
        assert self.interface.get_path() == 'exception'

    def test_args_as_keyword_args(self):
        inst = self.to_python(
            dict(values=[{
                'type': 'ValueError',
                'value': 'hello world',
                'module': 'foo.bar',
            }])
        )
        assert isinstance(inst.values[0], SingleException)
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_args_as_old_style(self):
        inst = self.to_python(
            {
                'type': 'ValueError',
                'value': 'hello world',
                'module': 'foo.bar',
            }
        )
        assert isinstance(inst.values[0], SingleException)
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_non_string_value_with_no_type(self):
        inst = self.to_python(
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

    def test_context_with_mixed_frames(self):
        inst = self.to_python(
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
            'exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['hasSystemFrames']

    def test_context_with_symbols(self):
        inst = self.to_python(
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
            'exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['stacktrace']['frames'][0]['symbol'] == 'Class.myfunc'

    def test_context_with_only_system_frames(self):
        inst = self.to_python(
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
            'exception': inst.to_json(),
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
        normalize_in_app({'exception': exc})
        inst = self.to_python(exc)

        self.create_event(data={
            'exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert not context['hasSystemFrames']

    def test_context_with_raw_stacks(self):
        inst = self.to_python(
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
            'exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['stacktrace']['frames'][0]['function'] == 'main'
        assert context['values'][0]['rawStacktrace']['frames'][0]['function'] == '<redacted>'

    def test_context_with_mechanism(self):
        inst = self.to_python(
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
            'exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['mechanism']['type'] == 'generic'

    def test_iteration(self):
        inst = self.to_python({
            'values': [None, {'type': 'ValueError'}, None]
        })

        assert len(inst) == 1
        assert inst[0].type == 'ValueError'
        for exc in inst:
            assert exc.type == 'ValueError'

    def test_slim_exception_data_under_max(self):
        interface = self.to_python(
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

    def test_slim_exception_data_over_max(self):
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

        interface = self.to_python({'values': values})

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
