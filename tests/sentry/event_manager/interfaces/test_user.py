# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest
import mock
from exam import fixture

from sentry.interfaces.base import InterfaceValidationError
from sentry.testutils import TestCase
from sentry.interfaces.user import User
from sentry.event_manager import EventManager
from sentry.models import Event


def to_python(data):
    mgr = EventManager(data={"user": data})
    mgr.normalize()
    evt = Event(data=mgr.get_data())
    if evt.data.get('errors'):
        raise InterfaceValidationError(evt.data.get('errors'))

    return evt.interfaces.get('user') or User.to_python({})


class UserTest(TestCase):
    @fixture
    def event(self):
        return mock.Mock(spec=Event())

    @fixture
    def interface(self):
        return to_python(dict(
            id=1,
            email='lol@example.com',
            favorite_color='brown',
        ))

    def test_null_values(self):
        sink = {}

        assert to_python({}).to_json() == sink

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
        with pytest.raises(InterfaceValidationError):
            to_python(dict(ip_address='abc'))

    def test_invalid_email_address(self):
        with pytest.raises(InterfaceValidationError):
            to_python(dict(email=1))

        user = to_python(dict(
            email='foo',
        ))
        assert user.email == 'foo'

    def test_extra_keys(self):
        u = to_python({
            'extra1': 'foo',
            'data': {'extra2': 'bar'},
        })

        assert u.data == {
            'extra1': 'foo',
            'extra2': 'bar',
        }
