# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from exam import fixture

from sentry.testutils import TestCase
from sentry.interfaces.user import User
from sentry.models import Event


class UserTest(TestCase):
    @fixture
    def event(self):
        return mock.Mock(spec=Event())

    @fixture
    def interface(self):
        return User.to_python(dict(
            id=1,
            email='lol@example.com',
            favorite_color='brown',
        ))

    def test_path(self):
        assert self.interface.get_path() == 'sentry.interfaces.User'

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'id': '1',
            'email': 'lol@example.com',
            'data': {'favorite_color': 'brown'}
        }

    def test_invalid_ip_address(self):
        with self.assertRaises(Exception):
            User.to_python(dict(
                ip_address='abc',
            ))

    def test_invalid_email_address(self):
        with self.assertRaises(Exception):
            User.to_python(dict(
                email=1,
            ))

        with self.assertRaises(Exception):
            User.to_python(dict(
                email='foo',
            ))

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()
