# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.testutils import TestCase, fixture


class ExceptionTest(TestCase):
    @fixture
    def interface(self):
        from sentry.interfaces import Exception

        return Exception(
            type='ValueError',
            value='hello world',
            module='foo.bar',
        )

    def test_serialize_behavior(self):
        assert self.interface.serialize() == {
            'type': self.interface.type,
            'value': self.interface.value,
            'module': self.interface.module,
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
