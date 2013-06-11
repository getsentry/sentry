# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock

from sentry.models import Group
from sentry.testutils import TestCase
from sentry.tasks.post_process import (
    record_affected_user, record_affected_code)


class RecordAffectedUserTest(TestCase):
    def test_simple(self):
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


class RecordAffectedCodeTest(TestCase):
    def test_simple(self):
        event = Group.objects.from_kwargs(1, message='foo', **{
            'sentry.interfaces.Exception': {
                'values': [{
                    'type': 'TypeError',
                    'value': 'test',
                    'stacktrace': {
                        'frames': [{
                            'function': 'bar',
                            'filename': 'foo.py',
                            'in_app': True,
                        }],
                    },
                }],
            },
        })

        with mock.patch.object(Group.objects, 'add_tags') as add_tags:
            record_affected_code(group=event.group, event=event)

            add_tags.assert_called_once_with(event.group, [
                ('sentry:filename', '1effb24729ae4c43efa36b460511136a', {
                    'filename': 'foo.py',
                }),
                ('sentry:function', '7823c20ad591da0bbb78d083c118609c', {
                    'filename': 'foo.py',
                    'function': 'bar',
                })
            ])
