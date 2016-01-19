# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.interfaces.exception import (
    SingleException, Exception, slim_frame_data
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

        self.create_event(data={
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


class TrimExceptionsTest(TestCase):
    def test_under_max(self):
        value = {'values': [
            {'value': 'foo',
             'stacktrace': {'frames': [{'filename': 'foo'}]},
            }
        ]}
        slim_frame_data(value)
        assert len(value['values'][0]['stacktrace']['frames']) == 1

    def test_over_max(self):
        values = []
        data = {'values': values}
        for x in xrange(5):
            exc = {'value': 'exc %d' % x, 'stacktrace': {'frames': []}}
            values.append(exc)
            for y in xrange(5):
                exc['stacktrace']['frames'].append({
                    'filename': 'frame %d' % y,
                    'vars': {},
                    'pre_context': [],
                    'post_context': [],
                })

        # slim to 10 frames to make tests easier
        slim_frame_data(data, 10)

        assert len(values) == 5
        for e_num, value in enumerate(values):
            assert value['value'] == 'exc %d' % e_num
            assert len(value['stacktrace']['frames']) == 5
            for f_num, frame in enumerate(value['stacktrace']['frames']):
                assert frame['filename'] == 'frame %d' % f_num
                if e_num in (0, 4):
                    assert frame['filename'] == 'frame %d' % f_num
                    assert frame['vars'] is not None
                    assert frame['pre_context'] is not None
                    assert frame['post_context'] is not None
                else:
                    assert frame['filename'] == 'frame %d' % f_num
                    assert 'vars' not in frame
                    assert 'pre_context' not in frame
                    assert 'post_context' not in frame
