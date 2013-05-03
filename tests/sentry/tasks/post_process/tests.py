# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import Group
from sentry.testutils import TestCase
from sentry.tasks.post_process import record_affected_user


class SentryManagerTest(TestCase):
    def test_records_users_seen(self):
        # TODO: we could lower the level of this test by just testing our signal receiver's logic
        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'foo@example.com',
            },
        })

        record_affected_user(group=event.group, event=event)

        group = Group.objects.get(id=event.group_id)
        assert group.users_seen == 1

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'foo@example.com',
            },
        })
        group = Group.objects.get(id=event.group_id)
        assert group.users_seen == 1

        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'bar@example.com',
            },
        })
        group = Group.objects.get(id=event.group_id)
        assert group.users_seen == 2
