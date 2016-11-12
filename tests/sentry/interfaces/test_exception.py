# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.exception import (
    SingleException, Exception, slim_exception_data
)
from sentry.testutils import TestCase


class ExceptionTest(TestCase):
    @fixture
    def interface(self):
        return Exception.to_python(dict(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': True,
            }]},
        }, {
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': True,
            }]},
        }]))

    def test_path(self):
        assert self.interface.get_path() == 'sentry.interfaces.Exception'

    def test_args_as_keyword_args(self):
        inst = Exception.to_python(dict(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
        }]))
        assert type(inst.values[0]) is SingleException
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_args_as_old_style(self):
        inst = Exception.to_python({
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
        })
        assert type(inst.values[0]) is SingleException
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

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
        inst = Exception.to_python(dict(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': True,
            }]},
        }, {
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': False,
            }]},
        }]))

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['hasSystemFrames']

    def test_context_with_symbols(self):
        inst = Exception.to_python(dict(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'function': 'myfunc',
                'symbol': 'Class.myfunc',
                'lineno': 1,
                'in_app': True,
            }]},
        }]))

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['stacktrace']['frames'][
            0]['symbol'] == 'Class.myfunc'

    def test_context_with_only_system_frames(self):
        inst = Exception.to_python(dict(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': False,
            }]},
        }, {
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': False,
            }]},
        }]))

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert not context['hasSystemFrames']

    def test_context_with_only_app_frames(self):
        inst = Exception.to_python(dict(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': True,
            }]},
        }, {
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.py',
                'lineno': 1,
                'in_app': True,
            }]},
        }]))

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert not context['hasSystemFrames']

    def test_context_with_raw_stacks(self):
        inst = Exception.to_python(dict(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foobar',
            'raw_stacktrace': {'frames': [{
                'filename': None,
                'lineno': 1,
                'function': '<redacted>',
                'in_app': True,
            }]},
            'stacktrace': {'frames': [{
                'filename': 'foo/baz.c',
                'lineno': 1,
                'function': 'main',
                'in_app': True,
            }]},
        }]))

        self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['values'][0]['stacktrace']['frames'][0]['function'] == 'main'
        assert context['values'][0]['rawStacktrace']['frames'][0]['function'] == '<redacted>'


class SingleExceptionTest(TestCase):
    @fixture
    def interface(self):
        return SingleException.to_python(dict(
            type='ValueError',
            value='hello world',
            module='foo.bar',
        ))

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
        result = SingleException.to_python(dict(
            type='ValueError',
            value='foo',
            stacktrace={'frames': []},
        ))
        assert not result.stacktrace

    def test_coerces_object_value_to_string(self):
        result = SingleException.to_python(dict(
            type='ValueError',
            value={'unauthorized': True},
        ))
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


class SlimExceptionDataTest(TestCase):
    def test_under_max(self):
        interface = Exception.to_python({'values': [
            {'value': 'foo',
             'stacktrace': {'frames': [{'filename': 'foo'}]},
            }
        ]})
        slim_exception_data(interface)
        assert len(interface.values[0].stacktrace.frames) == 1

    def test_over_max(self):
        values = []
        for x in range(5):
            exc = {'value': 'exc %d' % x, 'stacktrace': {'frames': []}}
            values.append(exc)
            for y in range(5):
                exc['stacktrace']['frames'].append({
                    'filename': 'exc %d frame %d' % (x, y),
                    'vars': {'foo': 'bar'},
                    'context_line': 'b',
                    'pre_context': ['a'],
                    'post_context': ['c'],
                })

        interface = Exception.to_python({'values': values})

        # slim to 10 frames to make tests easier
        slim_exception_data(interface, 10)

        assert len(interface.values) == 5
        for e_num, value in enumerate(interface.values):
            assert value.value == 'exc %d' % e_num
            assert len(value.stacktrace.frames) == 5
            for f_num, frame in enumerate(value.stacktrace.frames):
                assert frame.filename == 'exc %d frame %d' % (e_num, f_num)
                print(frame.filename)
                if e_num in (0, 4):
                    assert frame.vars is not None
                    assert frame.pre_context is not None
                    assert frame.post_context is not None
                else:
                    assert frame.vars is None
                    assert frame.pre_context is None
                    assert frame.post_context is None
