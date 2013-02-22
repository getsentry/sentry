# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
import pickle

from sentry.interfaces import Interface, get_context
from sentry.models import Event
from sentry.testutils import TestCase, fixture


class InterfaceBase(TestCase):
    @fixture
    def event(self):
        return Event(
            id=1,
        )


class InterfaceTest(InterfaceBase):
    @fixture
    def interface(self):
        return Interface(foo=1)

    def test_init_sets_attrs(self):
        assert self.interface.attrs == ['foo']

    def test_setstate_sets_attrs(self):
        data = pickle.dumps(self.interface)
        obj = pickle.loads(data)
        assert obj.attrs == ['foo']

    def test_to_html_default(self):
        assert self.interface.to_html(self.event) == ''

    def test_to_string_default(self):
        assert self.interface.to_string(self.event) == ''

    def test_get_search_context_default(self):
        assert self.interface.get_search_context(self.event) == {}

    @mock.patch('sentry.interfaces.Interface.get_hash')
    def test_get_composite_hash_calls_get_hash(self, get_hash):
        assert self.interface.get_composite_hash(self.event) == get_hash.return_value
        get_hash.assert_called_once_with()

    def test_validate_default(self):
        self.interface.validate()


class GetContextTest(TestCase):
    def test_works_with_empty_filename(self):
        result = get_context(0, 'hello world')
        assert result == [(0, 'hello world')]
