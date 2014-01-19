# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from exam import fixture

from sentry.testutils import TestCase
from sentry.interfaces import User
from sentry.models import Event


class UserTest(TestCase):
    @fixture
    def event(self):
        return mock.Mock(spec=Event())

    @fixture
    def interface(self):
        return User(id=1, email='lol@example.com', favorite_color='brown')

    def test_serialize_behavior(self):
        assert self.interface.serialize() == {
            'id': 1,
            'username': None,
            'email': 'lol@example.com',
            'ip_address': None,
            'data': {'favorite_color': 'brown'}
        }

    @mock.patch('sentry.interfaces.render_to_string')
    def test_to_html(self, render_to_string):
        interface = User(**self.interface.serialize())
        interface.to_html(self.event)
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
