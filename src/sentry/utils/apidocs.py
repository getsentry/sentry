from __future__ import absolute_import

import os
import re
import json
import base64
import inspect
import requests
import mimetypes

from contextlib import contextmanager
from datetime import datetime, timedelta
from django.conf import settings
from pytz import utc
from random import randint
from six import StringIO

# Do not import from sentry here!  Bad things will happen


optional_group_matcher = re.compile(r'\(\?\:([^\)]+)\)')
named_group_matcher = re.compile(r'\(\?P<(\w+)>[^\)]+\)')
non_named_group_matcher = re.compile(r'\([^\)]+\)')
# [foo|bar|baz]
either_option_matcher = re.compile(r'\[([^\]]+)\|([^\]]+)\]')
camel_re = re.compile(r'([A-Z]+)([a-z])')


API_PREFIX = '/api/0/'


scenarios = {}


def simplify_regex(pattern):
    """Clean up urlpattern regexes into something somewhat readable by
    Mere Humans: turns something like
    "^(?P<sport_slug>\w+)/athletes/(?P<athlete_slug>\w+)/$" into
    "{sport_slug}/athletes/{athlete_slug}/"
    """
    pattern = optional_group_matcher.sub(lambda m: '[%s]' % m.group(1), pattern)

    # handle named groups first
    pattern = named_group_matcher.sub(lambda m: '{%s}' % m.group(1), pattern)

    # handle non-named groups
    pattern = non_named_group_matcher.sub("{var}", pattern)

    # handle optional params
    pattern = either_option_matcher.sub(lambda m: m.group(1), pattern)

    # clean up any outstanding regex-y characters.
    pattern = pattern.replace('^', '').replace('$', '') \
        .replace('?', '').replace('//', '/').replace('\\', '')
    if not pattern.startswith('/'):
        pattern = '/' + pattern
    return pattern


def get_internal_endpoint_from_pattern(pattern):
    from sentry.api.base import Endpoint
    if not hasattr(pattern, 'callback'):
        return
    if hasattr(pattern.callback, 'cls'):
        cls = pattern.callback.cls
        if issubclass(cls, Endpoint):
            return cls
    elif hasattr(pattern.callback, 'cls_instance'):
        inst = pattern.callback.cls_instance
        if isinstance(inst, Endpoint):
            return inst.__class__


def extract_documentation(func):
    doc = inspect.getdoc(func)
    if doc is not None:
        return doc.decode('utf-8')


def get_endpoint_path(internal_endpoint):
    return '%s.%s' % (
        internal_endpoint.__module__,
        internal_endpoint.__name__,
    )


def extract_title_and_text(doc):
    title = None
    iterable = iter((doc or u'').splitlines())
    clean_end = False

    for line in iterable:
        line = line.strip()
        if title is None:
            if not line:
                continue
            title = line
        elif line[0] * len(line) == line:
            clean_end = True
            break
        else:
            break

    lines = []
    if clean_end:
        for line in iterable:
            if line.strip():
                lines.append(line)
                break
    lines.extend(iterable)

    return title, lines


def camelcase_to_dashes(string):
    def handler(match):
        camel, regular = match.groups()
        if len(camel) != 1:
            camel = camel[:-1].lower() + '-' + camel[-1].lower()
        else:
            camel = camel.lower()
        return '-' + camel + regular.lower()
    return camel_re.sub(handler, string).lstrip('-')


def extract_endpoint_info(pattern, internal_endpoint):
    path = simplify_regex(pattern.regex.pattern)
    from sentry.constants import HTTP_METHODS
    for method_name in HTTP_METHODS:
        if method_name in ('HEAD', 'OPTIONS'):
            continue
        method = getattr(internal_endpoint, method_name.lower(), None)
        if method is None:
            continue
        doc = extract_documentation(method)
        if doc is None:
            continue
        section = getattr(internal_endpoint, 'doc_section', None)
        if section is None:
            continue
        endpoint_name = method.__name__.title() + internal_endpoint.__name__
        if endpoint_name.endswith('Endpoint'):
            endpoint_name = endpoint_name[:-8]
        endpoint_name = camelcase_to_dashes(endpoint_name)
        title, text = extract_title_and_text(doc)
        yield dict(
            path=API_PREFIX + path.lstrip('/'),
            method=method_name,
            title=title,
            text=text,
            scenarios=getattr(method, 'api_scenarios', None) or [],
            section=section.name.lower(),
            internal_path='%s:%s' % (
                get_endpoint_path(internal_endpoint),
                method.__name__
            ),
            endpoint_name=endpoint_name,
        )


def iter_endpoints():
    from sentry.api.urls import urlpatterns
    for pattern in urlpatterns:
        internal_endpoint = get_internal_endpoint_from_pattern(pattern)
        if internal_endpoint is None:
            continue
        for endpoint in extract_endpoint_info(pattern, internal_endpoint):
            yield endpoint


def scenario(ident):
    def decorator(f):
        if ident in scenarios:
            raise RuntimeError('Scenario duplicate: %s' % ident)
        scenarios[ident] = f
        f.api_scenario_ident = ident
        return f
    return decorator


def attach_scenarios(scenarios):
    def decorator(f):
        f.api_scenarios = [x.api_scenario_ident for x in scenarios]
        return f
    return decorator


def iter_scenarios():
    # Make sure everything is imported.
    for endpoint in iter_endpoints():
        pass
    return iter(sorted(scenarios.items()))


def get_sections():
    from sentry.api.base import DocSection
    return dict((x.name.lower(), x.value) for x in DocSection)


def create_sample_time_series(event):
    from sentry.app import tsdb
    group = event.group

    now = datetime.utcnow().replace(tzinfo=utc)

    for _ in range(60):
        count = randint(1, 10)
        tsdb.incr_multi((
            (tsdb.models.project, group.project.id),
            (tsdb.models.group, group.id),
        ), now, count)
        tsdb.incr_multi((
            (tsdb.models.organization_total_received,
             group.project.organization_id),
            (tsdb.models.project_total_received, group.project.id),
        ), now, int(count * 1.1))
        tsdb.incr_multi((
            (tsdb.models.organization_total_rejected,
             group.project.organization_id),
            (tsdb.models.project_total_rejected, group.project.id),
        ), now, int(count * 0.1))
        now = now - timedelta(seconds=1)

    for _ in range(24 * 30):
        count = randint(100, 1000)
        tsdb.incr_multi((
            (tsdb.models.project, group.project.id),
            (tsdb.models.group, group.id),
        ), now, count)
        tsdb.incr_multi((
            (tsdb.models.organization_total_received,
             group.project.organization_id),
            (tsdb.models.project_total_received, group.project.id),
        ), now, int(count * 1.1))
        tsdb.incr_multi((
            (tsdb.models.organization_total_rejected,
             group.project.organization_id),
            (tsdb.models.project_total_rejected, group.project.id),
        ), now, int(count * 0.1))
        now = now - timedelta(hours=1)


class MockUtils(object):

    def create_user(self, mail):
        from sentry.models import User
        user, _ = User.objects.get_or_create(
            username=mail,
            defaults={
                'email': mail,
            }
        )
        user.set_password('dummy')
        user.save()
        return user

    def create_org(self, name, owner):
        from sentry.models import Organization, OrganizationMember
        org, _ = Organization.objects.get_or_create(
            name=name,
        )

        dummy_member, _ = OrganizationMember.objects.get_or_create(
            user=owner,
            organization=org,
            defaults={
                'role': 'member',
            }
        )

        return org

    def create_api_key(self, org, label='Default'):
        from sentry.models import ApiKey
        return ApiKey.objects.get_or_create(
            organization=org,
            label=label,
            scopes=(1 << len(ApiKey.scopes.keys())) - 1,
        )[0]

    def create_client_key(self, project, label='Default'):
        from sentry.models import ProjectKey
        return ProjectKey.objects.get_or_create(
            project=project,
            label=label
        )[0]

    def create_team(self, name, org):
        from sentry.models import Team
        return Team.objects.get_or_create(
            name=name,
            defaults={
                'organization': org,
            },
        )[0]

    def create_project(self, name, team, org):
        from sentry.models import Project
        return Project.objects.get_or_create(
            team=team,
            name=name,
            defaults={
                'organization': org,
            }
        )[0]

    def create_release(self, project, user, version=None):
        from sentry.models import Release, Activity
        if version is None:
            version = os.urandom(20).encode('hex')
        release = Release.objects.get_or_create(
            version=version,
            project=project,
        )[0]
        Activity.objects.create(
            type=Activity.RELEASE,
            project=project,
            ident=version,
            user=user,
            data={'version': version},
        )
        return release

    def create_release_file(self, project, release, path,
                            content_type=None, contents=None):
        from sentry.models import File, ReleaseFile
        if content_type is None:
            content_type = mimetypes.guess_type(path)[0] or 'text/plain'
            if content_type.startswith('text/'):
                content_type += '; encoding=utf-8'
        f = File.objects.create(
            name=path.rsplit('/', 1)[-1],
            type='release.file',
            headers={
                'Content-Type': content_type
            },
        )
        f.putfile(StringIO(contents or ''))
        return ReleaseFile.objects.create(
            project=project,
            release=release,
            file=f,
            name=path
        )

    def create_event(self, project, release, platform='python', raw=True):
        from sentry.utils.samples import create_sample_event
        event = create_sample_event(
            project=project,
            platform=platform,
            release=release.version,
            raw=raw
        )
        create_sample_time_series(event)
        return event


class Runner(object):
    """The runner is a special object that holds state for the automatic
    running of example scenarios.  It gets created by api-docs/generator.py
    which does the majority of the heavy lifting.  It mainly exists here
    so that the scenarios can be run separately if needed.
    """

    def __init__(self, ident, func, api_key, org, me, teams=None):
        self.ident = ident
        self.func = func
        self.requests = []

        self.utils = MockUtils()

        self.api_key = api_key
        self.org = org
        self.me = me
        self.teams = teams

    @property
    def default_team(self):
        return self.teams[0]['team']

    @property
    def default_project(self):
        return self.teams[0]['projects'][0]['project']

    @property
    def default_release(self):
        return self.teams[0]['projects'][0]['release']

    @property
    def default_event(self):
        return self.teams[0]['projects'][0]['events'][0]

    @contextmanager
    def isolated_project(self, project_name):
        from sentry.models import Group, Event

        project = self.utils.create_project(project_name,
                                            team=self.default_team,
                                            org=self.org)
        release = self.utils.create_release(project=project, user=self.me)
        self.utils.create_event(project=project, release=release,
                                platform='python')
        self.utils.create_event(project=project, release=release,
                                platform='java')
        try:
            yield project
        finally:
            # Enforce safe cascades into Group/Event
            Group.objects.filter(
                project=project,
            ).delete()
            Event.objects.filter(
                project_id=project.id,
            ).delete()
            project.delete()

    @contextmanager
    def isolated_org(self, org_name):
        from sentry.models import Group, Event

        org = self.utils.create_org(org_name, owner=self.me)
        try:
            yield org
        finally:
            # Enforce safe cascades into Group/Event
            Group.objects.filter(
                project__organization=org,
            ).delete()
            Event.objects.filter(
                project_id__in=org.project_set.values('id'),
            ).delete()
            org.delete()

    def request(self, method, path, headers=None, data=None, api_key=None,
                format='json'):
        if api_key is None:
            api_key = self.api_key
        path = '/api/0/' + path.lstrip('/')
        headers = dict(headers or {})

        request_is_json = True
        body = None
        files = None
        was_multipart = False
        if data is not None:
            if format == 'json':
                body = json.dumps(data, sort_keys=True)
                headers['Content-Type'] = 'application/json'
            elif format == 'multipart':
                files = {}
                for key, value in data.items():
                    if hasattr(value, 'read') or isinstance(value, tuple):
                        files[key] = value
                        del data[key]
                        was_multipart = True
                body = data

        req_headers = dict(headers)
        req_headers['Host'] = 'sentry.io'
        req_headers['Authorization'] = 'Basic %s' % base64.b64encode('%s:' % (
            api_key.key.encode('utf-8')))

        url = 'http://127.0.0.1:%s%s' % (
            settings.SENTRY_APIDOCS_WEB_PORT,
            path,
        )

        response = requests.request(method=method, url=url, files=files,
                                    headers=req_headers, data=body)
        response_headers = dict(response.headers)

        # Don't want those
        response_headers.pop('server', None)
        response_headers.pop('date', None)

        if response.headers.get('Content-Type') == 'application/json':
            response_data = response.json()
            is_json = True
        else:
            response_data = response.text
            is_json = False

        if was_multipart:
            headers['Content-Type'] = response.request.headers['content-type']
            data = response.request.body
            request_is_json = False

        rv = {
            'request': {
                'method': method,
                'path': path,
                'headers': headers,
                'data': data,
                'is_json': request_is_json,
            },
            'response': {
                'headers': response_headers,
                'status': response.status_code,
                'reason': response.reason,
                'data': response_data,
                'is_json': is_json,
            }
        }

        self.requests.append(rv)
        return rv

    def to_json(self):
        doc = extract_documentation(self.func)
        title, text = extract_title_and_text(doc)
        return {
            'ident': self.ident,
            'requests': self.requests,
            'title': title,
            'text': text,
        }
