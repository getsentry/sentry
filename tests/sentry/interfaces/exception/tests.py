# -*- coding: utf-8 -*-

from __future__ import absolute_import

from exam import fixture

from sentry.testutils import TestCase
from sentry.interfaces import unserialize


class ExceptionTest(TestCase):
    @fixture
    def interface(self):
        from sentry.interfaces import Exception

        return Exception([{
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
        }])

    def test_args_as_list(self):
        from sentry.interfaces import SingleException, Exception

        inst = Exception([{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
        }])
        assert type(inst.values[0]) is SingleException
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_args_as_keyword_args(self):
        from sentry.interfaces import SingleException, Exception

        inst = Exception(values=[{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
        }])
        assert type(inst.values[0]) is SingleException
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_args_as_old_style(self):
        from sentry.interfaces import SingleException, Exception

        inst = Exception(**{
            'type': 'ValueError',
            'value': 'hello world',
            'module': 'foo.bar',
        })
        assert type(inst.values[0]) is SingleException
        assert inst.values[0].type == 'ValueError'
        assert inst.values[0].value == 'hello world'
        assert inst.values[0].module == 'foo.bar'

    def test_serialize_unserialize_behavior(self):
        result = unserialize(type(self.interface), self.interface.serialize())
        assert self.interface.serialize() == result.serialize()

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


class SingleExceptionTest(TestCase):
    @fixture
    def interface(self):
        from sentry.interfaces import SingleException

        return SingleException(
            type='ValueError',
            value='hello world',
            module='foo.bar',
            stacktrace={'frames': []},
        )

    def test_serialize_behavior(self):
        assert self.interface.serialize() == {
            'type': self.interface.type,
            'value': self.interface.value,
            'module': self.interface.module,
            'stacktrace': self.interface.stacktrace.serialize(),
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
        result = unserialize(type(self.interface), self.interface.serialize())
        assert self.interface.serialize() == result.serialize()
