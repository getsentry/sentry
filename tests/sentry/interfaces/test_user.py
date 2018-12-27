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

    def test_null_values(self):
        sink = {}

        assert User.to_python({}).to_json() == sink

    def test_path(self):
        assert self.interface.get_path() == 'user'

    def test_serialize_behavior(self):
        assert self.interface.to_json() == {
            'id': '1',
            'email': 'lol@example.com',
            'data': {
                'favorite_color': 'brown'
            }
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

    def test_id_long_dict(self):
        u = User.to_python({
            'id': {x: 'foobarbaz' for x in range(10)},  # dict longer than 128 chars
        })
        assert len(u.to_json()['id']) == 128

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()

    def test_trimming(self):
        u = User.to_python({
            'name': ['v' * 100, 'v' * 100],
            'username': ['v' * 100, 'v' * 100],
        })

        assert len(u.name) <= 128
        assert len(u.username) <= 128

    def test_extra_keys(self):
        u = User.to_python({
            'extra1': 'foo',
            'data': {'extra2': 'bar'},
        })

        assert u.data == {
            'extra1': 'foo',
            'extra2': 'bar',
        }
