# -*- coding: utf-8 -*-
"""
sentry.testutils.fixtures
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function, unicode_literals

import copy
import json
import petname
import six
import warnings

from django.utils.text import slugify
from exam import fixture
from uuid import uuid4

from sentry.models import (
    Activity, Event, EventError, EventMapping, Group, Organization,
    OrganizationMember, OrganizationMemberTeam, Project, Team, User
)

DEFAULT_EVENT_DATA = {
    'extra': {
        'loadavg': [0.97607421875, 0.88330078125, 0.833984375],
        'sys.argv': [
            '/Users/dcramer/.virtualenvs/sentry/bin/raven',
            'test',
            'https://ebc35f33e151401f9deac549978bda11:f3403f81e12e4c24942d505f086b2cad@sentry.io/1'
        ],
        'user': 'dcramer'
    },
    'modules': {'raven': '3.1.13'},
    'sentry.interfaces.Http': {
        'cookies': {},
        'data': {},
        'env': {},
        'headers': {},
        'method': 'GET',
        'query_string': '',
        'url': 'http://example.com',
    },
    'sentry.interfaces.Stacktrace': {
        'frames': [
            {
                'abs_path': '/Users/dcramer/.virtualenvs/sentry/lib/python2.7/site-packages/raven/base.py',
                'context_line': '                        string_max_length=self.string_max_length)',
                'filename': 'raven/base.py',
                'function': 'build_msg',
                'in_app': False,
                'lineno': 290,
                'module': 'raven.base',
                'post_context': [
                    '                },',
                    '            })',
                    '',
                    "        if 'sentry.interfaces.Stacktrace' in data:",
                    '            if self.include_paths:'
                ],
                'pre_context': [
                    '',
                    '            data.update({',
                    "                'sentry.interfaces.Stacktrace': {",
                    "                    'frames': get_stack_info(frames,",
                    '                        list_max_length=self.list_max_length,'],
                'vars': {
                    'culprit': 'raven.scripts.runner',
                    'date': 'datetime.datetime(2013, 2, 14, 20, 6, 33, 479471)',
                    'event_id': '598fb19363e745ec8be665e6ba88b1b2',
                    'event_type': 'raven.events.Message',
                    'frames': '<generator object iter_stack_frames at 0x103fef050>',
                    'handler': '<raven.events.Message object at 0x103feb710>',
                    'k': 'sentry.interfaces.Message',
                    'public_key': None,
                    'result': {'sentry.interfaces.Message': "{'message': 'This is a test message generated using ``raven test``', 'params': []}"},
                    'self': '<raven.base.Client object at 0x104397f10>',
                    'stack': True,
                    'tags': None,
                    'time_spent': None,
                },
            },
        ],
    },
    'tags': [],
}


class Fixtures(object):
    @fixture
    def projectkey(self):
        return self.create_project_key(project=self.project)

    @fixture
    def user(self):
        return self.create_user('admin@localhost', is_superuser=True)

    @fixture
    def organization(self):
        # XXX(dcramer): ensure that your org slug doesnt match your team slug
        # and the same for your project slug
        return self.create_organization(
            name='baz',
            slug='baz',
            owner=self.user,
        )

    @fixture
    def team(self):
        team = self.create_team(
            organization=self.organization,
            name='foo',
            slug='foo',
        )
        # XXX: handle legacy team fixture
        queryset = OrganizationMember.objects.filter(
            organization=self.organization,
        )
        for om in queryset:
            OrganizationMemberTeam.objects.create(
                team=team,
                organizationmember=om,
                is_active=True,
            )
        return team

    @fixture
    def project(self):
        return self.create_project(
            name='Bar',
            slug='bar',
            team=self.team,
        )

    @fixture
    def group(self):
        return self.create_group(message=u'こんにちは')

    @fixture
    def event(self):
        return self.create_event(
            event_id='a' * 32,
            message=u'こんにちは',
        )

    @fixture
    def activity(self):
        return Activity.objects.create(
            group=self.group, project=self.project,
            type=Activity.NOTE, user=self.user,
            data={}
        )

    def create_organization(self, **kwargs):
        if not kwargs.get('name'):
            kwargs['name'] = petname.Generate(2, ' ').title()

        owner = kwargs.pop('owner', -1)
        if owner is -1:
            owner = self.user

        org = Organization.objects.create(**kwargs)
        if owner:
            self.create_member(
                organization=org,
                user=owner,
                role='owner',
            )
        return org

    def create_member(self, teams=None, **kwargs):
        kwargs.setdefault('role', 'member')

        om = OrganizationMember.objects.create(**kwargs)
        if teams:
            for team in teams:
                OrganizationMemberTeam.objects.create(
                    team=team,
                    organizationmember=om,
                    is_active=True,
                )
        return om

    def create_team(self, **kwargs):
        if not kwargs.get('name'):
            kwargs['name'] = petname.Generate(2, ' ').title()
        if not kwargs.get('slug'):
            kwargs['slug'] = slugify(six.text_type(kwargs['name']))
        if not kwargs.get('organization'):
            kwargs['organization'] = self.organization

        return Team.objects.create(**kwargs)

    def create_project(self, **kwargs):
        if not kwargs.get('name'):
            kwargs['name'] = petname.Generate(2, ' ').title()
        if not kwargs.get('slug'):
            kwargs['slug'] = slugify(six.text_type(kwargs['name']))
        if not kwargs.get('team'):
            kwargs['team'] = self.team
        if not kwargs.get('organization'):
            kwargs['organization'] = kwargs['team'].organization

        return Project.objects.create(**kwargs)

    def create_project_key(self, project):
        return project.key_set.get_or_create()[0]

    def create_user(self, email=None, **kwargs):
        if not email:
            email = uuid4().hex + '@example.com'

        kwargs.setdefault('username', email)
        kwargs.setdefault('is_staff', True)
        kwargs.setdefault('is_active', True)
        kwargs.setdefault('is_superuser', False)

        user = User(email=email, **kwargs)
        user.set_password('admin')
        user.save()

        return user

    def create_event(self, event_id=None, **kwargs):
        if event_id is None:
            event_id = uuid4().hex
        if 'group' not in kwargs:
            kwargs['group'] = self.group
        kwargs.setdefault('project', kwargs['group'].project)
        kwargs.setdefault('data', copy.deepcopy(DEFAULT_EVENT_DATA))
        if kwargs.get('tags'):
            tags = kwargs.pop('tags')
            if isinstance(tags, dict):
                tags = list(tags.items())
            kwargs['data']['tags'] = tags

        kwargs['data'].setdefault('errors', [{
            'type': EventError.INVALID_DATA,
            'name': 'foobar',
        }])

        # maintain simple event fixtures by supporting the legacy message
        # parameter just like our API would
        if 'sentry.interfaces.Message' not in kwargs['data']:
            kwargs['data']['sentry.interfaces.Message'] = {
                'message': kwargs.get('message') or '<unlabeled event>',
            }

        if 'type' not in kwargs['data']:
            kwargs['data'].update({
                'type': 'default',
                'metadata': {
                    'title': kwargs['data']['sentry.interfaces.Message']['message'],
                },
            })

        event = Event(
            event_id=event_id,
            **kwargs
        )
        EventMapping.objects.create(
            project_id=event.project.id,
            event_id=event_id,
            group=event.group,
        )
        # emulate EventManager refs
        event.data.bind_ref(event)
        event.save()
        return event

    def create_full_event(self, event_id='a', **kwargs):
        payload = """
            {
                "id": "f5dd88e612bc406ba89dfebd09120769",
                "project": 11276,
                "release": "e1b5d1900526feaf20fe2bc9cad83d392136030a",
                "platform": "javascript",
                "culprit": "app/components/events/eventEntries in map",
                "message": "TypeError: Cannot read property '1' of null",
                "tags": [
                    ["environment", "prod"],
                    ["sentry_version", "e1b5d1900526feaf20fe2bc9cad83d392136030a"],
                    ["level", "error"],
                    ["logger", "javascript"],
                    ["sentry:release", "e1b5d1900526feaf20fe2bc9cad83d392136030a"],
                    ["browser", "Chrome 48.0"],
                    ["device", "Other"],
                    ["os", "Windows 10"],
                    ["url", "https://sentry.io/katon-direct/localhost/issues/112734598/"],
                    ["sentry:user", "id:41656"]
                ],
                "errors": [{
                    "url": "<anonymous>",
                    "type": "js_no_source"
                }],
                "extra": {
                    "session:duration": 40364
                },
                "sentry.interfaces.Exception": {
                    "exc_omitted": null,
                    "values": [{
                        "stacktrace": {
                            "has_system_frames": false,
                            "frames": [{
                                "function": "batchedUpdates",
                                "abs_path": "webpack:////usr/src/getsentry/src/sentry/~/react/lib/ReactUpdates.js",
                                "pre_context": ["  // verify that that's the case. (This is called by each top-level update", "  // function, like setProps, setState, forceUpdate, etc.; creation and", "  // destruction of top-level components is guarded in ReactMount.)", "", "  if (!batchingStrategy.isBatchingUpdates) {"],
                                "post_context": ["    return;", "  }", "", "  dirtyComponents.push(component);", "}"],
                                "filename": "~/react/lib/ReactUpdates.js",
                                "module": "react/lib/ReactUpdates",
                                "colno": 0,
                                "in_app": false,
                                "data": {
                                    "orig_filename": "/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js",
                                    "orig_abs_path": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js",
                                    "sourcemap": "https://media.sentry.io/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map",
                                    "orig_lineno": 37,
                                    "orig_function": "Object.s [as enqueueUpdate]",
                                    "orig_colno": 16101
                                },
                                "context_line": "    batchingStrategy.batchedUpdates(enqueueUpdate, component);",
                                "lineno": 176
                            }],
                            "frames_omitted": null
                        },
                        "type": "TypeError",
                        "value": "Cannot read property '1' of null",
                        "module": null
                    }]
                },
                "sentry.interfaces.Http": {
                    "url": "https://sentry.io/katon-direct/localhost/issues/112734598/",
                    "headers": [
                        ["Referer", "https://sentry.io/welcome/"],
                        ["User-Agent", "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.109 Safari/537.36"]
                    ]
                },
                "sentry.interfaces.User": {
                    "ip_address": "0.0.0.0",
                    "id": "41656",
                    "email": "test@example.com"
                },
                "version": "7"
            }"""
        return self.create_event(event_id=event_id, platform='javascript', data=json.loads(payload))

    def create_group(self, project=None, checksum=None, **kwargs):
        if checksum:
            warnings.warn('Checksum passed to create_group', DeprecationWarning)
        kwargs.setdefault('message', 'Hello world')
        kwargs.setdefault('data', {})
        if 'type' not in kwargs['data']:
            kwargs['data'].update({
                'type': 'default',
                'metadata': {
                    'title': kwargs['message'],
                },
            })
        return Group.objects.create(
            project=project or self.project,
            **kwargs
        )
