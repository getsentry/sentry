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
import os
import petname
import random
import six
import warnings

from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.text import slugify
from exam import fixture
from hashlib import sha1
from loremipsum import Generator
from uuid import uuid4

from sentry.models import (
    Activity, Environment, Event, EventError, EventMapping, Group, Organization, OrganizationMember,
    OrganizationMemberTeam, Project, Team, User, UserEmail, Release, Commit, ReleaseCommit,
    CommitAuthor, Repository, CommitFileChange, ProjectDSymFile, File, UserPermission
)

loremipsum = Generator()


def make_sentence(words=None):
    if words is None:
        words = int(random.weibullvariate(8, 3))
    return ' '.join(random.choice(loremipsum.words) for _ in range(words))


def make_word(words=None):
    if words is None:
        words = int(random.weibullvariate(8, 3))
    return random.choice(loremipsum.words)


DEFAULT_EVENT_DATA = {
    'extra': {
        'loadavg': [0.97607421875, 0.88330078125, 0.833984375],
        'sys.argv': [
            '/Users/dcramer/.virtualenvs/sentry/bin/raven', 'test',
            'https://ebc35f33e151401f9deac549978bda11:f3403f81e12e4c24942d505f086b2cad@sentry.io/1'
        ],
        'user':
        'dcramer'
    },
    'modules': {
        'raven': '3.1.13'
    },
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
                'abs_path':
                'www/src/sentry/models/foo.py',
                'context_line':
                '                        string_max_length=self.string_max_length)',
                'filename':
                'sentry/models/foo.py',
                'function':
                'build_msg',
                'in_app':
                True,
                'lineno':
                29,
                'module':
                'raven.base',
                'post_context': [
                    '                },', '            })', '',
                    "        if 'sentry.interfaces.Stacktrace' in data:",
                    '            if self.include_paths:'
                ],
                'pre_context': [
                    '', '            data.update({',
                    "                'sentry.interfaces.Stacktrace': {",
                    "                    'frames': get_stack_info(frames,",
                    '                        list_max_length=self.list_max_length,'
                ],
                'vars': {
                    'culprit': 'raven.scripts.runner',
                    'date': 'datetime.datetime(2013, 2, 14, 20, 6, 33, 479471)',
                    'event_id': '598fb19363e745ec8be665e6ba88b1b2',
                    'event_type': 'raven.events.Message',
                    'frames': '<generator object iter_stack_frames at 0x103fef050>',
                    'handler': '<raven.events.Message object at 0x103feb710>',
                    'k': 'sentry.interfaces.Message',
                    'public_key': None,
                    'result': {
                        'sentry.interfaces.Message':
                        "{'message': 'This is a test message generated using ``raven test``', 'params': []}"
                    },
                    'self': '<raven.base.Client object at 0x104397f10>',
                    'stack': True,
                    'tags': None,
                    'time_spent': None,
                },
            },
            {
                'abs_path':
                '/Users/dcramer/.virtualenvs/sentry/lib/python2.7/site-packages/raven/base.py',
                'context_line':
                '                        string_max_length=self.string_max_length)',
                'filename':
                'raven/base.py',
                'function':
                'build_msg',
                'in_app':
                False,
                'lineno':
                290,
                'module':
                'raven.base',
                'post_context': [
                    '                },', '            })', '',
                    "        if 'sentry.interfaces.Stacktrace' in data:",
                    '            if self.include_paths:'
                ],
                'pre_context': [
                    '', '            data.update({',
                    "                'sentry.interfaces.Stacktrace': {",
                    "                    'frames': get_stack_info(frames,",
                    '                        list_max_length=self.list_max_length,'
                ],
                'vars': {
                    'culprit': 'raven.scripts.runner',
                    'date': 'datetime.datetime(2013, 2, 14, 20, 6, 33, 479471)',
                    'event_id': '598fb19363e745ec8be665e6ba88b1b2',
                    'event_type': 'raven.events.Message',
                    'frames': '<generator object iter_stack_frames at 0x103fef050>',
                    'handler': '<raven.events.Message object at 0x103feb710>',
                    'k': 'sentry.interfaces.Message',
                    'public_key': None,
                    'result': {
                        'sentry.interfaces.Message':
                        "{'message': 'This is a test message generated using ``raven test``', 'params': []}"
                    },
                    'self': '<raven.base.Client object at 0x104397f10>',
                    'stack': True,
                    'tags': None,
                    'time_spent': None,
                },
            },
        ],
    },
    'tags': [],
    'platform': 'python',
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
            teams=[self.team],
        )

    @fixture
    def environment(self):
        return self.create_environment(
            name='development',
            project=self.project,
        )

    @fixture
    def group(self):
        return self.create_group(message=u'\u3053\u3093\u306b\u3061\u306f')

    @fixture
    def event(self):
        return self.create_event(
            event_id='a' * 32,
            message=u'\u3053\u3093\u306b\u3061\u306f',
        )

    @fixture
    def activity(self):
        return Activity.objects.create(
            group=self.group, project=self.project, type=Activity.NOTE, user=self.user, data={}
        )

    def create_organization(self, name=None, owner=None, **kwargs):
        if not name:
            name = petname.Generate(2, ' ', letters=10).title()

        org = Organization.objects.create(name=name, **kwargs)
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
                self.create_team_membership(
                    team=team,
                    member=om,
                )
        return om

    def create_team_membership(self, team, member=None, user=None):
        if member is None:
            member, _ = OrganizationMember.objects.get_or_create(
                user=user,
                organization=team.organization,
                defaults={
                    'role': 'member',
                }
            )

        return OrganizationMemberTeam.objects.create(
            team=team,
            organizationmember=member,
            is_active=True,
        )

    def create_team(self, **kwargs):
        if not kwargs.get('name'):
            kwargs['name'] = petname.Generate(2, ' ', letters=10).title()
        if not kwargs.get('slug'):
            kwargs['slug'] = slugify(six.text_type(kwargs['name']))
        if not kwargs.get('organization'):
            kwargs['organization'] = self.organization
        members = kwargs.pop('members', None)

        team = Team.objects.create(**kwargs)
        if members:
            for user in members:
                self.create_team_membership(team=team, user=user)
        return team

    def create_environment(self, **kwargs):
        project = kwargs.get('project', self.project)
        name = kwargs.get('name', petname.Generate(3, ' ', letters=10)[:64])
        env = Environment.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            name=name,
        )
        env.add_project(project)
        return env

    def create_project(self, **kwargs):
        teams = kwargs.pop('teams', None)

        if teams is None:
            teams = [self.team]

        if not kwargs.get('name'):
            kwargs['name'] = petname.Generate(2, ' ', letters=10).title()
        if not kwargs.get('slug'):
            kwargs['slug'] = slugify(six.text_type(kwargs['name']))
        if not kwargs.get('organization'):
            kwargs['organization'] = teams[0].organization

        project = Project.objects.create(**kwargs)
        for team in teams:
            project.add_team(team)
        return project

    def create_project_key(self, project):
        return project.key_set.get_or_create()[0]

    # TODO(maxbittker) make new fixtures less hardcoded
    def create_release(self, project, user=None, version=None):
        if version is None:
            version = os.urandom(20).encode('hex')

        release = Release.objects.create(
            version=version,
            organization_id=project.organization_id,
        )

        release.add_project(project)

        Activity.objects.create(
            type=Activity.RELEASE,
            project=project,
            ident=Activity.get_version_ident(version),
            user=user,
            data={'version': version},
        )

        # add commits
        if user:
            author = self.create_commit_author(project, user)
            repo = self.create_repo(project, name='organization-{}'.format(project.slug))
            commit = self.create_commit(
                project=project,
                repo=repo,
                author=author,
                release=release,
                key='deadbeef',
                message='placeholder commit message',
            )

            release.update(
                authors=[six.text_type(author.id)],
                commit_count=1,
                last_commit_id=commit.id,
            )

        return release

    def create_repo(self, project, name=None):
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=name or '{}-{}'.format(petname.Generate(2, '',
                                                         letters=10), random.randint(1000, 9999)),
        )
        return repo

    def create_commit(self, project, repo, author=None, release=None,
                      message=None, key=None, date_added=None):
        commit = Commit.objects.get_or_create(
            organization_id=project.organization_id,
            repository_id=repo.id,
            key=key or sha1(uuid4().hex).hexdigest(),
            defaults={
                'message': message or make_sentence(),
                'author': author or self.create_commit_author(project),
                'date_added': date_added or timezone.now(),
            }
        )[0]

        if release:
            ReleaseCommit.objects.create(
                organization_id=project.organization_id,
                project_id=project.id,
                release=release,
                commit=commit,
                order=1,
            )

        self.create_commit_file_change(commit, project, '/models/foo.py')
        self.create_commit_file_change(commit, project, '/worsematch/foo.py')
        self.create_commit_file_change(commit, project, '/models/other.py')

        return commit

    def create_commit_author(self, project, user=None):
        return CommitAuthor.objects.get_or_create(
            organization_id=project.organization_id,
            email=user.email if user else '{}@example.com'.format(make_word()),
            defaults={
                'name': user.name if user else make_word(),
            }
        )[0]

    def create_commit_file_change(self, commit, project, filename):
        commit_file_change = CommitFileChange.objects.get_or_create(
            organization_id=project.organization_id,
            commit=commit,
            filename=filename,
            type='M',
        )
        return commit_file_change

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

        # UserEmail is created by a signal
        assert UserEmail.objects.filter(
            user=user,
            email=email,
        ).update(is_verified=True)

        return user

    def create_useremail(self, user, email, **kwargs):
        if not email:
            email = uuid4().hex + '@example.com'

        kwargs.setdefault('is_verified', True)

        useremail = UserEmail(user=user, email=email, **kwargs)
        useremail.save()

        return useremail

    def create_event(self, event_id=None, **kwargs):
        if event_id is None:
            event_id = uuid4().hex
        if 'group' not in kwargs:
            kwargs['group'] = self.group
        kwargs.setdefault('project', kwargs['group'].project)
        kwargs.setdefault('data', copy.deepcopy(DEFAULT_EVENT_DATA))
        kwargs.setdefault('platform', kwargs['data'].get('platform', 'python'))
        kwargs.setdefault('message', kwargs['data'].get('message', 'message'))
        if kwargs.get('tags'):
            tags = kwargs.pop('tags')
            if isinstance(tags, dict):
                tags = list(tags.items())
            kwargs['data']['tags'] = tags

        kwargs['data'].setdefault(
            'errors', [{
                'type': EventError.INVALID_DATA,
                'name': 'foobar',
            }]
        )

        # maintain simple event fixtures by supporting the legacy message
        # parameter just like our API would
        if 'sentry.interfaces.Message' not in kwargs['data']:
            kwargs['data']['sentry.interfaces.Message'] = {
                'message': kwargs.get('message') or '<unlabeled event>',
            }

        if 'type' not in kwargs['data']:
            kwargs['data'].update(
                {
                    'type': 'default',
                    'metadata': {
                        'title': kwargs['data']['sentry.interfaces.Message']['message'],
                    },
                }
            )

        event = Event(event_id=event_id, **kwargs)
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
                "version": "7",
                "sentry.interfaces.Breadcrumbs": {
                    "values": [
                        {
                            "category": "xhr",
                            "timestamp": 1496395011.63,
                            "type": "http",
                            "data": {
                                "url": "/api/path/here",
                                "status_code": "500",
                                "method": "POST"
                            }
                        }
                    ]
                }
            }"""

        return self.create_event(event_id=event_id, platform='javascript',
                                 data=json.loads(payload))

    def create_group(self, project=None, checksum=None, **kwargs):
        if checksum:
            warnings.warn('Checksum passed to create_group', DeprecationWarning)
        if project is None:
            project = self.project
        kwargs.setdefault('message', 'Hello world')
        kwargs.setdefault('data', {})
        if 'type' not in kwargs['data']:
            kwargs['data'].update(
                {
                    'type': 'default',
                    'metadata': {
                        'title': kwargs['message'],
                    },
                }
            )
        if 'short_id' not in kwargs:
            kwargs['short_id'] = project.next_short_id()
        return Group.objects.create(project=project, ** kwargs)

    def create_file(self, **kwargs):
        return File.objects.create(**kwargs)

    def create_dsym_file(self, project=None, **kwargs):
        if project is None:
            project = self.project

        return ProjectDSymFile.objects.create(project=project, **kwargs)

    def add_user_permission(self, user, permission):
        try:
            with transaction.atomic():
                UserPermission.objects.create(user=user, permission=permission)
        except IntegrityError:
            raise
