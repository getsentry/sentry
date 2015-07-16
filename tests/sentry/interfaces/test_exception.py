# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.exception import (
    SingleException, Exception, trim_exceptions
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
        print result
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

        event = self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert context['hasSystemFrames']

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

        event = self.create_event(data={
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

        event = self.create_event(data={
            'sentry.interfaces.Exception': inst.to_json(),
        })
        context = inst.get_api_context()
        assert not context['hasSystemFrames']


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
            'stacktrace': None,
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


class TrimExceptionsTest(TestCase):
    def test_under_max(self):
        value = {'values': [{'value': 'foo'}]}
        trim_exceptions(value)
        assert len(value['values']) == 1
        assert value.get('exc_omitted') is None

    def test_over_max(self):
        values = []
        for n in xrange(5):
            values.append({'value': 'frame %d' % n})
        value = {'values': values}
        trim_exceptions(value, max_values=4)

        assert len(value['values']) == 4

        for value, num in zip(values[:2], xrange(2)):
            assert value['value'] == 'frame %d' % num

        for value, num in zip(values[2:], xrange(3, 5)):
            assert value['value'] == 'frame %d' % num
