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
            'id': 1,
            'email': 'lol@example.com',
            'data': {'favorite_color': 'brown'}
        }

    @mock.patch('sentry.interfaces.user.render_to_string')
    def test_to_html(self, render_to_string):
        self.interface.to_html(self.event)
        render_to_string.assert_called_once_with('sentry/partial/interfaces/user.html', {
            'is_public': False,
            'event': self.event,
            'user_ip_address': None,
            'user_id': 1,
            'user_username': None,
            'user_email': 'lol@example.com',
            'user_data': {'favorite_color': 'brown'},
        })

    def test_to_html_public(self):
        result = self.interface.to_html(self.event, is_public=True)
        assert result == ''

    def test_serialize_unserialize_behavior(self):
        result = type(self.interface).to_python(self.interface.to_json())
        assert result.to_json() == self.interface.to_json()
