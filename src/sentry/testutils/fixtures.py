"""
sentry.testutils.fixtures
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function, unicode_literals

import json
import six
import warnings

from django.utils.text import slugify
from exam import fixture
from uuid import uuid4

from sentry.models import (
    Activity, Event, Group, Organization, OrganizationMember,
    OrganizationMemberTeam, Project, Team, User
)
from sentry.utils.compat import pickle
from sentry.utils.strings import decompress


# an example data blog from Sentry 5.4.1 (db level)
LEGACY_DATA = pickle.loads(decompress("""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"""))


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
        return self.create_group(message='Foo bar')

    @fixture
    def event(self):
        return self.create_event(event_id='a' * 32)

    @fixture
    def activity(self):
        return Activity.objects.create(
            group=self.group, project=self.project,
            type=Activity.NOTE, user=self.user,
            data={}
        )

    def create_organization(self, **kwargs):
        owner = kwargs.pop('owner', None)
        if not owner:
            owner = self.user

        kwargs.setdefault('name', uuid4().hex)

        org = Organization.objects.create(**kwargs)
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
        kwargs.setdefault('name', uuid4().hex)
        if not kwargs.get('slug'):
            kwargs['slug'] = slugify(six.text_type(kwargs['name']))
        if not kwargs.get('organization'):
            kwargs['organization'] = self.organization

        return Team.objects.create(**kwargs)

    def create_project(self, **kwargs):
        kwargs.setdefault('name', uuid4().hex)
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
        kwargs.setdefault('message', kwargs['group'].message)
        kwargs.setdefault('data', LEGACY_DATA.copy())
        if kwargs.get('tags'):
            tags = kwargs.pop('tags')
            if isinstance(tags, dict):
                tags = tags.items()
            kwargs['data']['tags'] = tags

        event = Event(
            event_id=event_id,
            **kwargs
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
                    ["url", "https://app.getsentry.com/katon-direct/localhost/issues/112734598/"],
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
                                    "orig_abs_path": "https://media.getsentry.com/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js",
                                    "sourcemap": "https://media.getsentry.com/_static/29e365f8b0d923bc123e8afa38d890c3/sentry/dist/vendor.js.map",
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
                    "url": "https://app.getsentry.com/katon-direct/localhost/issues/112734598/",
                    "headers": [
                        ["Referer", "https://getsentry.com/welcome/"],
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
        return Group.objects.create(
            project=project or self.project,
            **kwargs
        )
