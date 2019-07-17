# -*- coding: utf-8 -*-
from __future__ import absolute_import, print_function, unicode_literals

from django.conf import settings

import copy
import io
import os
import petname
import random
import six
import warnings
from importlib import import_module

from django.utils import timezone
from django.utils.text import slugify
from hashlib import sha1
from loremipsum import Generator
from uuid import uuid4

from sentry.event_manager import EventManager
from sentry.constants import SentryAppStatus
from sentry.incidents.models import (
    Incident,
    IncidentGroup,
    IncidentProject,
    IncidentSeen,
    IncidentActivity,
)
from sentry.mediators import sentry_apps, sentry_app_installations, service_hooks
from sentry.models import (
    Activity, Environment, Event, EventError, EventMapping, Group, Organization, OrganizationMember,
    OrganizationMemberTeam, Project, ProjectBookmark, Team, User, UserEmail, Release, Commit, ReleaseCommit,
    CommitAuthor, Repository, CommitFileChange, ProjectDebugFile, File, UserPermission, EventAttachment,
    UserReport, PlatformExternalIssue,
)
from sentry.models.integrationfeature import Feature, IntegrationFeature
from sentry.utils import json
from sentry.utils.canonical import CanonicalKeyDict

loremipsum = Generator()


def get_fixture_path(name):
    return os.path.join(
        os.path.dirname(__file__),  # src/sentry/testutils/
        os.pardir,  # src/sentry/
        os.pardir,  # src/
        os.pardir,
        'tests',
        'fixtures',
        name
    )


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


def _patch_artifact_manifest(path, org, release, project=None):
    manifest = json.loads(open(path, 'rb').read())
    manifest['org'] = org
    manifest['release'] = release
    if project:
        manifest['project'] = project
    return json.dumps(manifest)


# TODO(dcramer): consider moving to something more scaleable like factoryboy
class Factories(object):
    @staticmethod
    def create_organization(name=None, owner=None, **kwargs):
        if not name:
            name = petname.Generate(2, ' ', letters=10).title()

        org = Organization.objects.create(name=name, **kwargs)
        if owner:
            Factories.create_member(
                organization=org,
                user=owner,
                role='owner',
            )
        return org

    @staticmethod
    def create_member(teams=None, **kwargs):
        kwargs.setdefault('role', 'member')

        om = OrganizationMember.objects.create(**kwargs)
        if teams:
            for team in teams:
                Factories.create_team_membership(
                    team=team,
                    member=om,
                )
        return om

    @staticmethod
    def create_team_membership(team, member=None, user=None):
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

    @staticmethod
    def create_team(organization, **kwargs):
        if not kwargs.get('name'):
            kwargs['name'] = petname.Generate(2, ' ', letters=10).title()
        if not kwargs.get('slug'):
            kwargs['slug'] = slugify(six.text_type(kwargs['name']))
        members = kwargs.pop('members', None)

        team = Team.objects.create(organization=organization, **kwargs)
        if members:
            for user in members:
                Factories.create_team_membership(team=team, user=user)
        return team

    @staticmethod
    def create_environment(project, **kwargs):
        name = kwargs.get('name', petname.Generate(3, ' ', letters=10)[:64])
        env = Environment.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            name=name,
        )
        env.add_project(project, is_hidden=kwargs.get('is_hidden'))
        return env

    @staticmethod
    def create_project(organization=None, teams=None, **kwargs):
        if not kwargs.get('name'):
            kwargs['name'] = petname.Generate(2, ' ', letters=10).title()
        if not kwargs.get('slug'):
            kwargs['slug'] = slugify(six.text_type(kwargs['name']))
        if not organization and teams:
            organization = teams[0].organization

        project = Project.objects.create(organization=organization, **kwargs)
        if teams:
            for team in teams:
                project.add_team(team)
        return project

    @staticmethod
    def create_project_bookmark(project, user):
        return ProjectBookmark.objects.create(project_id=project.id, user=user)

    @staticmethod
    def create_project_key(project):
        return project.key_set.get_or_create()[0]

    @staticmethod
    def create_release(project, user=None, version=None, date_added=None):
        if version is None:
            version = os.urandom(20).encode('hex')

        if date_added is None:
            date_added = timezone.now()

        release = Release.objects.create(
            version=version,
            organization_id=project.organization_id,
            date_added=date_added,
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
            author = Factories.create_commit_author(project=project, user=user)
            repo = Factories.create_repo(project, name='organization-{}'.format(project.slug))
            commit = Factories.create_commit(
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

    @staticmethod
    def create_artifact_bundle(org, release, project=None):
        import zipfile

        bundle = io.BytesIO()
        bundle_dir = get_fixture_path('artifact_bundle')
        with zipfile.ZipFile(bundle, 'w', zipfile.ZIP_DEFLATED) as zipfile:
            for path, _, files in os.walk(bundle_dir):
                for filename in files:
                    fullpath = os.path.join(path, filename)
                    relpath = os.path.relpath(fullpath, bundle_dir)
                    if filename == 'manifest.json':
                        manifest = _patch_artifact_manifest(fullpath, org, release, project)
                        zipfile.writestr(relpath, manifest)
                    else:
                        zipfile.write(fullpath, relpath)

        return bundle.getvalue()

    @staticmethod
    def create_repo(project, name=None):
        repo = Repository.objects.create(
            organization_id=project.organization_id,
            name=name or '{}-{}'.format(petname.Generate(2, '',
                                                            letters=10), random.randint(1000, 9999)),
        )
        return repo

    @staticmethod
    def create_commit(repo, project=None, author=None, release=None,
                      message=None, key=None, date_added=None):
        commit = Commit.objects.get_or_create(
            organization_id=repo.organization_id,
            repository_id=repo.id,
            key=key or sha1(uuid4().hex).hexdigest(),
            defaults={
                'message': message or make_sentence(),
                'author': author or Factories.create_commit_author(organization_id=repo.organization_id),
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

        Factories.create_commit_file_change(commit=commit, filename='/models/foo.py')
        Factories.create_commit_file_change(commit=commit, filename='/worsematch/foo.py')
        Factories.create_commit_file_change(commit=commit, filename='/models/other.py')

        return commit

    @staticmethod
    def create_commit_author(organization_id=None, project=None, user=None):
        return CommitAuthor.objects.get_or_create(
            organization_id=organization_id or project.organization_id,
            email=user.email if user else '{}@example.com'.format(make_word()),
            defaults={
                'name': user.name if user else make_word(),
            }
        )[0]

    @staticmethod
    def create_commit_file_change(commit, filename):
        return CommitFileChange.objects.get_or_create(
            organization_id=commit.organization_id,
            commit=commit,
            filename=filename,
            type='M',
        )

    @staticmethod
    def create_user(email=None, **kwargs):
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

    @staticmethod
    def create_useremail(user, email, **kwargs):
        if not email:
            email = uuid4().hex + '@example.com'

        kwargs.setdefault('is_verified', True)

        useremail = UserEmail(user=user, email=email, **kwargs)
        useremail.save()

        return useremail

    @staticmethod
    def create_event(group=None, project=None, event_id=None, normalize=True, **kwargs):
        # XXX: Do not use this method for new tests! Prefer `store_event`.
        if event_id is None:
            event_id = uuid4().hex
        kwargs.setdefault('project', project if project else group.project)
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

        # maintain simple event Factories by supporting the legacy message
        # parameter just like our API would
        if 'logentry' not in kwargs['data']:
            kwargs['data']['logentry'] = {
                'message': kwargs['message'] or '<unlabeled event>',
            }

        if normalize:
            manager = EventManager(CanonicalKeyDict(kwargs['data']))
            manager.normalize()
            kwargs['data'] = manager.get_data()
            kwargs['data'].update(manager.materialize_metadata())
            kwargs['message'] = manager.get_search_message()

        # This is needed so that create_event saves the event in nodestore
        # under the correct key. This is usually dont in EventManager.save()
        kwargs['data'].setdefault(
            'node_id',
            Event.generate_node_id(kwargs['project'].id, event_id)
        )

        event = Event(event_id=event_id, group=group, **kwargs)
        if group:
            EventMapping.objects.create(
                project_id=event.project.id,
                event_id=event_id,
                group=group,
            )
        # emulate EventManager refs
        event.data.bind_ref(event)
        event.save()
        return event

    @staticmethod
    def store_event(data, project_id, assert_no_errors=True):
        # Like `create_event`, but closer to how events are actually
        # ingested. Prefer to use this method over `create_event`
        manager = EventManager(data)
        manager.normalize()
        if assert_no_errors:
            errors = manager.get_data().get('errors')
            assert not errors, errors

        event = manager.save(project_id)
        if event.group:
            event.group.save()
        return event

    @staticmethod
    def create_full_event(group, event_id='a', **kwargs):
        payload = """
            {
                "event_id": "f5dd88e612bc406ba89dfebd09120769",
                "project": 11276,
                "release": "e1b5d1900526feaf20fe2bc9cad83d392136030a",
                "platform": "javascript",
                "culprit": "app/components/events/eventEntries in map",
                "logentry": {"formatted": "TypeError: Cannot read property '1' of null"},
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

        event = Factories.create_event(
            group=group,
            event_id=event_id, platform='javascript',
            data=json.loads(payload),

            # This payload already went through sourcemap
            # processing, normalizing it would remove
            # frame.data (orig_filename, etc)
            normalize=False
        )
        return event

    @staticmethod
    def create_group(project, checksum=None, **kwargs):
        if checksum:
            warnings.warn('Checksum passed to create_group', DeprecationWarning)
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

    @staticmethod
    def create_file(**kwargs):
        return File.objects.create(**kwargs)

    @staticmethod
    def create_file_from_path(path, name=None, **kwargs):
        if name is None:
            name = os.path.basename(path)

        file = Factories.create_file(name=name, **kwargs)
        with open(path) as f:
            file.putfile(f)
        return file

    @staticmethod
    def create_event_attachment(event, file=None, **kwargs):
        if file is None:
            file = Factories.create_file(
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

    @staticmethod
    def create_dif_file(project, debug_id=None, object_name=None,
                        features=None, data=None, file=None, cpu_name=None,
                        code_id=None, **kwargs):
        if debug_id is None:
            debug_id = six.text_type(uuid4())

        if object_name is None:
            object_name = '%s.dSYM' % debug_id

        if features is not None:
            if data is None:
                data = {}
            data['features'] = features

        if file is None:
            file = Factories.create_file(
                name=object_name,
                size=42,
                headers={'Content-Type': 'application/x-mach-binary'},
                checksum='dc1e3f3e411979d336c3057cce64294f3420f93a',
            )

        return ProjectDebugFile.objects.create(
            debug_id=debug_id,
            code_id=code_id,
            project=project,
            object_name=object_name,
            cpu_name=cpu_name or 'x86_64',
            file=file,
            data=data,
            **kwargs
        )

    @staticmethod
    def create_dif_from_path(path, object_name=None, **kwargs):
        if object_name is None:
            object_name = os.path.basename(path)

        headers = {'Content-Type': 'application/x-mach-binary'}
        file = Factories.create_file_from_path(path, name=object_name, headers=headers)
        return Factories.create_dif_file(file=file, object_name=object_name, **kwargs)

    @staticmethod
    def add_user_permission(user, permission):
        UserPermission.objects.create(user=user, permission=permission)

    @staticmethod
    def create_sentry_app(**kwargs):
        app = sentry_apps.Creator.run(
            **Factories._sentry_app_kwargs(**kwargs)
        )

        if kwargs.get('published'):
            app.update(status=SentryAppStatus.PUBLISHED)

        return app

    @staticmethod
    def create_internal_integration(**kwargs):
        app = sentry_apps.InternalCreator.run(
            **Factories._sentry_app_kwargs(**kwargs)
        )
        app.update(verify_install=False)
        return app

    @staticmethod
    def _sentry_app_kwargs(**kwargs):
        _kwargs = {
            'user': kwargs.get('user', Factories.create_user()),
            'name': kwargs.get('name', petname.Generate(2, ' ', letters=10).title()),
            'organization': kwargs.get('organization', Factories.create_organization()),
            'author': kwargs.get('author', 'A Company'),
            'scopes': kwargs.get('scopes', ()),
            'verify_install': kwargs.get('verify_install', True),
            'webhook_url': kwargs.get('webhook_url', 'https://example.com/webhook'),
            'events': [],
            'schema': {},
        }

        _kwargs.update(**kwargs)
        return _kwargs

    @staticmethod
    def create_sentry_app_installation(organization=None, slug=None, user=None):
        if not organization:
            organization = Factories.create_organization()

        Factories.create_project(organization=organization)

        return sentry_app_installations.Creator.run(
            slug=(slug or Factories.create_sentry_app().slug),
            organization=organization,
            user=(user or Factories.create_user()),
        )

    @staticmethod
    def create_issue_link_schema():
        return {
            'type': 'issue-link',
            'link': {
                'uri': '/sentry/issues/link',
                'required_fields': [
                    {
                        'type': 'select',
                        'name': 'assignee',
                        'label': 'Assignee',
                        'uri': '/sentry/members',
                    },
                ],
            },

            'create': {
                'uri': '/sentry/issues/create',
                'required_fields': [
                    {
                        'type': 'text',
                        'name': 'title',
                        'label': 'Title',
                    },
                    {
                        'type': 'text',
                        'name': 'summary',
                        'label': 'Summary',
                    },
                ],

                'optional_fields': [
                    {
                        'type': 'select',
                        'name': 'points',
                        'label': 'Points',
                        'options': [
                            ['1', '1'],
                            ['2', '2'],
                            ['3', '3'],
                            ['5', '5'],
                            ['8', '8'],
                        ],
                    },
                    {
                        'type': 'select',
                        'name': 'assignee',
                        'label': 'Assignee',
                        'uri': '/sentry/members',
                    },
                ],
            },
        }

    @staticmethod
    def create_alert_rule_action_schema():
        return {
            'type': 'alert-rule-action',
            'required_fields': [{
                'type': 'text',
                'name': 'channel',
                'label': 'Channel',
            }],
        }

    @staticmethod
    def create_service_hook(actor=None, org=None, project=None,
                            events=None, url=None, **kwargs):
        if not actor:
            actor = Factories.create_user()
        if not org:
            org = Factories.create_organization(owner=actor)
        if not project:
            project = Factories.create_project(organization=org)
        if events is None:
            events = ('event.created',)
        if not url:
            url = 'https://example.com/sentry/webhook'

        _kwargs = {
            'actor': actor,
            'projects': [project],
            'organization': org,
            'events': events,
            'url': url,
        }

        _kwargs.update(kwargs)

        return service_hooks.Creator.run(**_kwargs)

    @staticmethod
    def create_sentry_app_feature(feature=None, sentry_app=None, description=None):
        if not sentry_app:
            sentry_app = Factories.create_sentry_app()

        integration_feature = IntegrationFeature.objects.create(
            sentry_app=sentry_app,
            feature=feature or Feature.API,
        )

        if description:
            integration_feature.update(user_description=description)

        return integration_feature

    @staticmethod
    def create_userreport(group, project=None, event_id=None, **kwargs):
        return UserReport.objects.create(
            group=group,
            event_id=event_id or 'a' * 32,
            project=project or group.project,
            name='Jane Doe',
            email='jane@example.com',
            comments="the application crashed",
            **kwargs
        )

    @staticmethod
    def create_session():
        engine = import_module(settings.SESSION_ENGINE)

        session = engine.SessionStore()
        session.save()
        return session

    @staticmethod
    def create_platform_external_issue(group=None, service_type=None,
                                       display_name=None, web_url=None):
        return PlatformExternalIssue.objects.create(
            group_id=group.id,
            service_type=service_type,
            display_name=display_name,
            web_url=web_url,
        )

    @staticmethod
    def create_incident(
        organization, projects, detection_uuid=None, status=1,
        title=None, query='test query', date_started=None, date_detected=None,
        date_closed=None, groups=None, seen_by=None,
    ):
        if not title:
            title = petname.Generate(2, ' ', letters=10).title()

        incident = Incident.objects.create(
            organization=organization,
            detection_uuid=detection_uuid,
            status=status,
            title=title,
            query=query,
            date_started=date_started or timezone.now(),
            date_detected=date_detected or timezone.now(),
            date_closed=date_closed or timezone.now(),
        )
        for project in projects:
            IncidentProject.objects.create(incident=incident, project=project)
        if groups:
            for group in groups:
                IncidentGroup.objects.create(incident=incident, group=group)
        if seen_by:
            for user in seen_by:
                IncidentSeen.objects.create(incident=incident, user=user, last_seen=timezone.now())
        return incident

    @staticmethod
    def create_incident_activity(incident, type, comment=None, user=None):
        return IncidentActivity.objects.create(
            incident=incident,
            type=type,
            comment=comment,
            user=user,
        )
