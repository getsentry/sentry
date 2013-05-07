# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.models import Group
from sentry.testutils import TestCase
from sentry.tasks.post_process import record_affected_user


class RecordAffectedUserTest(TestCase):
    def test_records_users_seen(self):
        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.User': {
                'email': 'foo@example.com',
            },
        })

        with mock.patch.object(Group.objects, 'add_tags') as add_tags:
            record_affected_user(group=event.group, event=event)

            add_tags.assert_called_once(event.group, [
                ('sentry:user', 'email:foo@example.com', {
                    'id': None,
                    'email': 'foo@example.com',
                    'username': None,
                    'data': None,
                })
            ])
