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

from sentry.event_manager import EventManager
from sentry.constants import SentryAppStatus
from sentry.mediators import sentry_apps, sentry_app_installations, service_hooks
from sentry.models import (
    Activity, Commit, CommitAuthor, CommitFileChange, Environment, Event,
    EventAttachment, EventError, EventMapping, EventProcessingIssue, File,
    Group, Organization, OrganizationMember, OrganizationMemberTeam,
    ProcessingIssue, Project, ProjectBookmark, ProjectDebugFile, RawEvent,
    Release, ReleaseCommit, Repository, Team, User, UserEmail, UserPermission,
    UserReport,
)
from sentry.utils.canonical import CanonicalKeyDict

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
    'request': {
        'cookies': {},
        'data': {},
        'env': {},
        'headers': {},
        'method': 'GET',
        'query_string': '',
        'url': 'http://example.com',
    },
    'stacktrace': {
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
                    "        if 'stacktrace' in data:",
                    '            if self.include_paths:'
                ],
                'pre_context': [
                    '', '            data.update({',
                    "                'stacktrace': {",
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
                    'k': 'logentry',
                    'public_key': None,
                    'result': {
                        'logentry':
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
                    "        if 'stacktrace' in data:",
                    '            if self.include_paths:'
                ],
                'pre_context': [
                    '', '            data.update({',
                    "                'stacktrace': {",
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
                    'k': 'logentry',
                    'public_key': None,
                    'result': {
                        'logentry':
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

    def create_project_bookmark(self, project, user):
        return ProjectBookmark.objects.create(project_id=project.id, user=user)

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
            author = self.create_commit_author(project=project, user=user)
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

    def create_commit(self, repo, project=None, author=None, release=None,
                      message=None, key=None, date_added=None):
        commit = Commit.objects.get_or_create(
            organization_id=repo.organization_id,
            repository_id=repo.id,
            key=key or sha1(uuid4().hex).hexdigest(),
            defaults={
                'message': message or make_sentence(),
                'author': author or self.create_commit_author(organization_id=repo.organization_id),
                'date_added': date_added or timezone.now(),
            }
        )[0]

        if release:
            assert project
            ReleaseCommit.objects.create(
                organization_id=repo.organization_id,
                project_id=project.id,
                release=release,
                commit=commit,
                order=1,
            )

        self.create_commit_file_change(commit=commit, filename='/models/foo.py')
        self.create_commit_file_change(commit=commit, filename='/worsematch/foo.py')
        self.create_commit_file_change(commit=commit, filename='/models/other.py')

        return commit

    def create_commit_author(self, organization_id=None, project=None, user=None):
        return CommitAuthor.objects.get_or_create(
            organization_id=organization_id or project.organization_id,
            email=user.email if user else '{}@example.com'.format(make_word()),
            defaults={
                'name': user.name if user else make_word(),
            }
        )[0]

    def create_commit_file_change(self, commit, filename):
        commit_file_change = CommitFileChange.objects.get_or_create(
            organization_id=commit.organization_id,
            commit=commit,
            filename=filename,
            type='M',
        )
        return commit_file_change

    def create_user(self, email=None, **kwargs):
        if email is None:
            email = uuid4().hex + '@example.com'

        kwargs.setdefault('username', email)
        kwargs.setdefault('is_staff', True)
        kwargs.setdefault('is_active', True)
        kwargs.setdefault('is_superuser', False)

        user = User(email=email, **kwargs)
        if not kwargs.get('password'):
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

    def create_event(self, event_id=None, normalize=True, **kwargs):
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
        if kwargs.get('stacktrace'):
            stacktrace = kwargs.pop('stacktrace')
            kwargs['data']['stacktrace'] = stacktrace

        user = kwargs.pop('user', None)
        if user is not None:
            kwargs['data']['user'] = user

        kwargs['data'].setdefault(
            'errors', [{
                'type': EventError.INVALID_DATA,
                'name': 'foobar',
            }]
        )

        # maintain simple event fixtures by supporting the legacy message
        # parameter just like our API would
        if 'logentry' not in kwargs['data']:
            kwargs['data']['logentry'] = {
                'message': kwargs.get('message') or '<unlabeled event>',
            }

        if normalize:
            manager = EventManager(CanonicalKeyDict(kwargs['data']),
                                   for_store=False)
            manager.normalize()
            kwargs['data'] = manager.get_data()
            kwargs['message'] = manager.get_search_message()

        else:
            assert 'message' not in kwargs, 'do not pass message this way'

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
                "exception": {
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
                "request": {
                    "url": "https://sentry.io/katon-direct/localhost/issues/112734598/",
                    "headers": [
                        ["Referer", "https://sentry.io/welcome/"],
                        ["User-Agent", "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.109 Safari/537.36"]
                    ]
                },
                "user": {
                    "ip_address": "0.0.0.0",
                    "id": "41656",
                    "email": "test@example.com"
                },
                "version": "7",
                "breadcrumbs": {
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
        return Group.objects.create(project=project, **kwargs)

    def create_file(self, **kwargs):
        return File.objects.create(**kwargs)

    def create_file_from_path(self, path, name=None, **kwargs):
        if name is None:
            name = os.path.basename(path)

        file = self.create_file(name=name, **kwargs)
        with open(path) as f:
            file.putfile(f)
        return file

    def create_event_attachment(self, event=None, file=None, **kwargs):
        if event is None:
            event = self.event

        if file is None:
            file = self.create_file(
                name='log.txt',
                size=32,
                headers={'Content-Type': 'text/plain'},
                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            )

        return EventAttachment.objects.create(
            project_id=event.project_id,
            group_id=event.group_id,
            event_id=event.event_id,
            file=file,
            **kwargs
        )

    def create_dif_file(self, debug_id=None, project=None, object_name=None,
                        features=None, data=None, file=None, cpu_name=None, **kwargs):
        if project is None:
            project = self.project

        if debug_id is None:
            debug_id = six.text_type(uuid4())

        if object_name is None:
            object_name = '%s.dSYM' % debug_id

        if features is not None:
            if data is None:
                data = {}
            data['features'] = features

        if file is None:
            file = self.create_file(
                name=object_name,
                size=42,
                headers={'Content-Type': 'application/x-mach-binary'},
                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            )

        return ProjectDebugFile.objects.create(
            debug_id=debug_id,
            project=project,
            object_name=object_name,
            cpu_name=cpu_name or 'x86_64',
            file=file,
            data=data,
            **kwargs
        )

        return ProjectDebugFile.objects.create(project=project, **kwargs)

    def create_dif_from_path(self, path, object_name=None, **kwargs):
        if object_name is None:
            object_name = os.path.basename(path)

        headers = {'Content-Type': 'application/x-mach-binary'}
        file = self.create_file_from_path(path, name=object_name, headers=headers)
        return self.create_dif_file(file=file, object_name=object_name, **kwargs)

    def add_user_permission(self, user, permission):
        try:
            with transaction.atomic():
                UserPermission.objects.create(user=user, permission=permission)
        except IntegrityError:
            raise

    def create_sentry_app(self, name=None, organization=None, published=False, scopes=(),
                          webhook_url=None, **kwargs):
        if not name:
            name = petname.Generate(2, ' ', letters=10).title()
        if not organization:
            organization = self.create_organization()
        if not webhook_url:
            webhook_url = 'https://example.com/webhook'

        _kwargs = {
            'name': name,
            'organization': organization,
            'scopes': scopes,
            'webhook_url': webhook_url,
            'events': [],
        }

        _kwargs.update(kwargs)

        app = sentry_apps.Creator.run(**_kwargs)

        if published:
            app.update(status=SentryAppStatus.PUBLISHED)

        return app

    def create_sentry_app_installation(self, organization=None, slug=None, user=None):
        return sentry_app_installations.Creator.run(
            slug=(slug or self.create_sentry_app().slug),
            organization=(organization or self.create_organization()),
            user=(user or self.create_user()),
        )

    def create_service_hook(self, actor=None, project=None, events=None, url=None, **kwargs):
        if not actor:
            actor = self.create_user()
        if not project:
            org = self.create_organization(owner=actor)
            project = self.create_project(organization=org)
        if not events:
            events = ('event.created',)
        if not url:
            url = 'https://example/sentry/webhook'

        _kwargs = {
            'actor': actor,
            'project': project,
            'events': events,
            'url': url,
        }

        _kwargs.update(kwargs)

        return service_hooks.Creator.run(**_kwargs)

    def create_userreport(self, **kwargs):
        userreport = UserReport.objects.create(
            group=kwargs['group'],
            event_id='a' * 32,
            project=kwargs['project'],
            name='Jane Doe',
            email='jane@example.com',
            comments="the application crashed"
        )

        return userreport

    def create_raw_event(self, **kwargs):
        return RawEvent.objects.create(
            project=kwargs.get('project', self.project),
            event_id=kwargs.get('event_id', petname.Generate(1, '', letters=10).title()),
        )

    def create_processing_issue(self, **kwargs):
        return ProcessingIssue.objects.create(
            project=kwargs.get('project', self.project),
            checksum=kwargs.get('checksum', petname.Generate(1, '', letters=20).title()),
            type=kwargs.get('type', EventError.NATIVE_MISSING_DSYM),
        )

    def create_event_processing_issue(self, raw_event=None, processing_issue=None):
        if raw_event is None:
            raw_event = self.create_raw_event()
        if processing_issue is None:
            processing_issue = self.create_processing_issue()
        return EventProcessingIssue.objects.create(
            raw_event=raw_event,
            processing_issue=processing_issue,
        )
