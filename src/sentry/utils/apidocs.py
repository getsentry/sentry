from __future__ import absolute_import

import os
import re
import inspect
import requests
import mimetypes
from binascii import hexlify

from collections import defaultdict
from copy import copy
from contextlib import contextmanager
from datetime import datetime, timedelta
from django.conf import settings
from django.conf.urls import RegexURLResolver, RegexURLPattern
from django.db import transaction
from docutils.core import publish_doctree
from pytz import utc
from random import randint
from six import StringIO
from sentry.utils.compat import map
from sentry.utils import json

# Do not import from sentry here!  Bad things will happen

optional_group_matcher = re.compile(r"\(\?\:([^\)]+)\)")
named_group_matcher = re.compile(r"\(\?P<(\w+)>[^\)]+\)")
non_named_group_matcher = re.compile(r"\([^\)]+\)")
# [foo|bar|baz]
either_option_matcher = re.compile(r"\[([^\]]+)\|([^\]]+)\]")
camel_re = re.compile(r"([A-Z]+)([a-z])")
rst_indent_re = re.compile(r"^\s{2,}")
rst_block_re = re.compile(r"^\.\.\s[a-z]+::$")

API_PREFIX = "/api/0/"

scenarios = {}


def simplify_regex(pattern):
    """Clean up urlpattern regexes into something somewhat readable by
    Mere Humans: turns something like
    "^(?P<sport_slug>\w+)/athletes/(?P<athlete_slug>\w+)/$" into
    "{sport_slug}/athletes/{athlete_slug}/"
    """
    pattern = optional_group_matcher.sub(lambda m: "[%s]" % m.group(1), pattern)

    # handle named groups first
    pattern = named_group_matcher.sub(lambda m: "{%s}" % m.group(1), pattern)

    # handle non-named groups
    pattern = non_named_group_matcher.sub("{var}", pattern)

    # handle optional params
    pattern = either_option_matcher.sub(lambda m: m.group(1), pattern)

    # clean up any outstanding regex-y characters.
    pattern = (
        pattern.replace("^", "")
        .replace("$", "")
        .replace("?", "")
        .replace("//", "/")
        .replace("\\", "")
    )
    if not pattern.startswith("/"):
        pattern = "/" + pattern
    return pattern


def get_internal_endpoint_from_pattern(pattern):
    from sentry.api.base import Endpoint

    if not hasattr(pattern, "callback"):
        return
    if hasattr(pattern.callback, "cls"):
        cls = pattern.callback.cls
        if issubclass(cls, Endpoint):
            return cls
    elif hasattr(pattern.callback, "cls_instance"):
        inst = pattern.callback.cls_instance
        if isinstance(inst, Endpoint):
            return inst.__class__


def extract_documentation(func):
    doc = inspect.getdoc(func)
    if doc is not None:
        return doc.decode("utf-8")


def get_endpoint_path(internal_endpoint):
    return "%s.%s" % (internal_endpoint.__module__, internal_endpoint.__name__)


def parse_doc_string(doc):
    """
    Parse a docstring into a tuple.

    The tuple contains:

    (title, lines, warning, params)

    `lines` is a list for backwards compatibility with
    the JSON formatter.
    """
    title = None
    current_param = ""
    in_warning = False
    param_lines = []
    lines = []
    warning = []
    iterable = iter((doc or u"").splitlines())

    for line in iterable:
        stripped = line.strip()
        if title is None:
            if not line:
                continue
            title = line.strip()
        elif stripped and stripped[0] * len(stripped) == stripped:
            # is an RST underline
            continue
        elif rst_block_re.match(stripped):
            # Presently the only RST block we use is `caution` which
            # displays as a 'warning'
            in_warning = True
        elif line and stripped.startswith(":"):
            # Is a new parameter or other annotation
            if current_param:
                param_lines.append(current_param)
            current_param = stripped
        elif current_param:
            # Adding to an existing parameter annotation
            current_param = current_param + " " + stripped
        else:
            if in_warning:
                # If we're indented at least 2 spaces assume
                # we're in the RST block
                if rst_indent_re.match(line) or not line:
                    warning.append(stripped)
                    continue
                # An un-indented non-empty line means we
                # have other content.
                elif line:
                    in_warning = False
            # Normal text. We want empty lines here so we can
            # preserve paragraph breaks.
            lines.append(stripped)

    if current_param:
        param_lines.append(current_param)

    if warning:
        warning = "\n".join(warning).strip()
    if not warning:
        warning = None

    return title, lines, warning, parse_params(param_lines)


def get_node_text(nodes):
    """Recursively read text from a node tree."""
    text = []
    format_tags = {"literal": "`", "strong": "**", "emphasis": "*"}
    for node in nodes:
        # Handle inline formatting elements.
        if node.nodeType == node.ELEMENT_NODE and node.tagName in format_tags:
            wrap = format_tags[node.tagName]
            text.append(wrap + get_node_text(node.childNodes) + wrap)
            continue
        if node.nodeType == node.TEXT_NODE:
            text.append(node.data)
        if node.nodeType == node.ELEMENT_NODE:
            text.append(get_node_text(node.childNodes))
    return "".join(text)


def parse_params(params):
    """
    Parse parameter annotations.

    docutils doesn't give us much to work with, but
    we can get a DomDocument and traverse that for path parameters
    and query parameters, and layer on some text munging to get
    enough data to make the output we need.
    """
    parsed = defaultdict(list)
    param_tree = publish_doctree("\n".join(params)).asdom()
    field_names = param_tree.getElementsByTagName("field_name")
    field_values = param_tree.getElementsByTagName("field_body")

    for i, field in enumerate(field_names):
        name = get_node_text(field.childNodes)
        value = ""
        field_value = field_values.item(i)
        if field_value:
            value = get_node_text(field_value.childNodes)
        if name.startswith("pparam"):
            field_type = "path"
            name = name[7:]
        elif name.startswith("qparam"):
            field_type = "query"
            name = name[7:]
        elif name.startswith("auth"):
            field_type = "auth"
            name = ""
        else:
            field_type = "param"
            _, name = name.split(" ", 1)

        # Split out the parameter type
        param_type = ""
        if " " in name:
            param_type, name = name.split(" ", 1)
        parsed[field_type].append(dict(name=name, type=param_type, description=value))
    return parsed


def camelcase_to_dashes(string):
    def handler(match):
        camel, regular = match.groups()
        if len(camel) != 1:
            camel = camel[:-1].lower() + "-" + camel[-1].lower()
        else:
            camel = camel.lower()
        return "-" + camel + regular.lower()

    return camel_re.sub(handler, string).lstrip("-")


def extract_endpoint_info(pattern, internal_endpoint, parents):
    path = simplify_regex(pattern.regex.pattern)
    from sentry.constants import HTTP_METHODS

    for method_name in HTTP_METHODS:
        if method_name in ("HEAD", "OPTIONS"):
            continue
        method = getattr(internal_endpoint, method_name.lower(), None)
        if method is None:
            continue
        doc = extract_documentation(method)
        if doc is None:
            continue
        section = getattr(internal_endpoint, "doc_section", None)
        if section is None:
            continue
        endpoint_name = method.__name__.title() + internal_endpoint.__name__
        if endpoint_name.endswith("Endpoint"):
            endpoint_name = endpoint_name[:-8]
        endpoint_name = camelcase_to_dashes(endpoint_name)
        title, text, warning, params = parse_doc_string(doc)
        if not parents:
            api_path = API_PREFIX + path.lstrip("/")
        else:
            parents_prefix = "".join(map(lambda x: x.lstrip("/"), parents))
            api_path = API_PREFIX + parents_prefix.lstrip("/") + path.lstrip("/")

        yield dict(
            path=api_path,
            method=method_name,
            title=title,
            text=text,
            warning=warning,
            params=params,
            scenarios=getattr(method, "api_scenarios", None) or [],
            section=section.name.lower(),
            internal_path="%s:%s" % (get_endpoint_path(internal_endpoint), method.__name__),
            endpoint_name=endpoint_name,
        )


def flatten(l):
    return [item for sublist in l for item in sublist]


def resolve_nested_routes(pattern, current_parents=None):
    """
    Returns a list of tuples. The first element in the tuple is a RegexURLPattern. The second element is
    a string list of all the parents that url pattern has.
    """
    if current_parents:
        parents = copy(current_parents)
    else:
        parents = []

    if isinstance(pattern, RegexURLPattern):
        return [(pattern, current_parents)]
    elif isinstance(pattern, RegexURLResolver):
        parent = simplify_regex(pattern.regex.pattern)
        parents.append(parent)
        return flatten(map(lambda p: resolve_nested_routes(p, parents), pattern.url_patterns))
    elif isinstance(pattern, list):
        return flatten(map(lambda p: resolve_nested_routes(p, current_parents), pattern))


def iter_endpoints():
    from sentry.api.urls import urlpatterns

    resolved_patterns = resolve_nested_routes(urlpatterns)

    for pattern, parents in resolved_patterns:
        internal_endpoint = get_internal_endpoint_from_pattern(pattern)
        if internal_endpoint is None:
            continue
        for endpoint in extract_endpoint_info(pattern, internal_endpoint, parents):
            yield endpoint


def scenario(ident):
    def decorator(f):
        if ident in scenarios:
            raise RuntimeError("Scenario duplicate: %s" % ident)
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
        tsdb.incr_multi(
            ((tsdb.models.project, group.project.id), (tsdb.models.group, group.id)), now, count
        )
        tsdb.incr_multi(
            (
                (tsdb.models.organization_total_received, group.project.organization_id),
                (tsdb.models.project_total_received, group.project.id),
            ),
            now,
            int(count * 1.1),
        )
        tsdb.incr_multi(
            (
                (tsdb.models.organization_total_rejected, group.project.organization_id),
                (tsdb.models.project_total_rejected, group.project.id),
            ),
            now,
            int(count * 0.1),
        )
        now = now - timedelta(seconds=1)

    for _ in range(24 * 30):
        count = randint(100, 1000)
        tsdb.incr_multi(
            ((tsdb.models.project, group.project.id), (tsdb.models.group, group.id)), now, count
        )
        tsdb.incr_multi(
            (
                (tsdb.models.organization_total_received, group.project.organization_id),
                (tsdb.models.project_total_received, group.project.id),
            ),
            now,
            int(count * 1.1),
        )
        tsdb.incr_multi(
            (
                (tsdb.models.organization_total_rejected, group.project.organization_id),
                (tsdb.models.project_total_rejected, group.project.id),
            ),
            now,
            int(count * 0.1),
        )
        now = now - timedelta(hours=1)


class MockUtils(object):
    def create_user(self, mail):
        from sentry.models import User

        user, _ = User.objects.get_or_create(username=mail, defaults={"email": mail})
        user.set_password("dummy")
        user.save()
        return user

    def create_org(self, name, owner):
        from sentry.models import Organization, OrganizationMember

        org, _ = Organization.objects.get_or_create(name=name)

        dummy_member, _ = OrganizationMember.objects.get_or_create(
            user=owner, organization=org, defaults={"role": "owner"}
        )

        return org

    def create_api_token(self, user):
        from django.conf import settings
        from sentry.models import ApiToken

        return ApiToken.objects.create(
            user=user, scope_list=settings.SENTRY_SCOPES, refresh_token=None, expires_at=None
        )

    def create_client_key(self, project, label="Default"):
        from sentry.models import ProjectKey

        return ProjectKey.objects.get_or_create(project=project, label=label)[0]

    def create_team(self, name, org):
        from sentry.models import Team

        return Team.objects.get_or_create(name=name, defaults={"organization": org})[0]

    def join_team(self, team, user):
        from sentry.models import OrganizationMember, OrganizationMemberTeam

        member = OrganizationMember.objects.get(
            organization_id=team.organization_id, user_id=user.id
        )
        return OrganizationMemberTeam.objects.create(team=team, organizationmember=member)

    def create_project(self, name, teams, org):
        from sentry.models import Project

        project = Project.objects.get_or_create(name=name, defaults={"organization": org})[0]
        for team in teams:
            project.add_team(team)
        return project

    def create_release(self, project, user, version=None):
        from sentry.models import Release, Activity

        if version is None:
            version = hexlify(os.urandom(20))
        with transaction.atomic():
            release = Release.objects.filter(
                version=version, organization_id=project.organization_id, projects=project
            ).first()
            if not release:
                release = Release.objects.filter(
                    version=version, organization_id=project.organization_id
                ).first()
                if not release:
                    release = Release.objects.create(
                        version=version, organization_id=project.organization_id
                    )
                release.add_project(project)
        Activity.objects.create(
            type=Activity.RELEASE,
            project=project,
            ident=Activity.get_version_ident(version),
            user=user,
            data={"version": version},
        )
        return release

    def create_release_file(self, project, release, path, content_type=None, contents=None):
        from sentry.models import File, ReleaseFile

        if content_type is None:
            content_type = mimetypes.guess_type(path)[0] or "text/plain"
            if content_type.startswith("text/"):
                content_type += "; encoding=utf-8"
        f = File.objects.create(
            name=path.rsplit("/", 1)[-1],
            type="release.file",
            headers={"Content-Type": content_type},
        )
        f.putfile(StringIO(contents or ""))
        return ReleaseFile.objects.create(
            organization_id=project.organization_id, release=release, file=f, name=path
        )

    def create_event(self, project, release, platform="python", raw=True):
        from sentry.utils.samples import create_sample_event

        event = create_sample_event(
            project=project, platform=platform, release=release.version, raw=raw
        )
        create_sample_time_series(event)
        return event


class Runner(object):
    """The runner is a special object that holds state for the automatic
    running of example scenarios.  It gets created by api-docs/generator.py
    which does the majority of the heavy lifting.  It mainly exists here
    so that the scenarios can be run separately if needed.
    """

    def __init__(self, ident, func, api_token, org, me, teams=None):
        self.ident = ident
        self.func = func
        self.requests = []

        self.utils = MockUtils()

        self.api_token = api_token
        self.org = org
        self.me = me
        self.teams = teams

    @property
    def default_team(self):
        return self.teams[0]["team"]

    @property
    def default_project(self):
        return self.teams[0]["projects"][0]["project"]

    @property
    def default_release(self):
        return self.teams[0]["projects"][0]["release"]

    @property
    def default_event(self):
        return self.teams[0]["projects"][0]["events"][0]

    @contextmanager
    def isolated_project(self, project_name):
        from sentry.models import Group

        project = self.utils.create_project(project_name, teams=[self.default_team], org=self.org)
        release = self.utils.create_release(project=project, user=self.me)
        self.utils.create_event(project=project, release=release, platform="python")
        self.utils.create_event(project=project, release=release, platform="java")
        try:
            yield project
        finally:
            # Enforce safe cascades into Group
            Group.objects.filter(project=project).delete()
            project.delete()

    @contextmanager
    def isolated_org(self, org_name):
        from sentry.models import Group

        org = self.utils.create_org(org_name, owner=self.me)
        try:
            yield org
        finally:
            # Enforce safe cascades into Group
            Group.objects.filter(project__organization=org).delete()
            org.delete()

    def request(self, method, path, headers=None, data=None, api_token=None, format="json"):
        if api_token is None:
            api_token = self.api_token
        path = "/api/0/" + path.lstrip("/")
        headers = dict(headers or {})

        request_is_json = True
        body = None
        files = None
        was_multipart = False
        if data is not None:
            if format == "json":
                body = json.dumps(data, sort_keys=True)
                headers["Content-Type"] = "application/json"
            elif format == "multipart":
                files = {}
                for key, value in data.items():
                    if hasattr(value, "read") or isinstance(value, tuple):
                        files[key] = value
                        del data[key]
                        was_multipart = True
                body = data

        req_headers = dict(headers)
        req_headers["Host"] = "sentry.io"
        req_headers["Authorization"] = "Bearer %s" % api_token.token

        url = "http://127.0.0.1:%s%s" % (settings.SENTRY_APIDOCS_WEB_PORT, path)

        response = requests.request(
            method=method, url=url, files=files, headers=req_headers, data=body
        )
        response_headers = dict(response.headers)

        # Don't want those
        response_headers.pop("server", None)
        response_headers.pop("date", None)

        if response.headers.get("Content-Type") == "application/json":
            response_data = response.json()
            is_json = True
        else:
            response_data = response.text
            is_json = False

        if was_multipart:
            headers["Content-Type"] = response.request.headers["content-type"]
            data = response.request.body
            request_is_json = False

        rv = {
            "request": {
                "method": method,
                "path": path,
                "headers": headers,
                "data": data,
                "is_json": request_is_json,
            },
            "response": {
                "headers": response_headers,
                "status": response.status_code,
                "reason": response.reason,
                "data": response_data,
                "is_json": is_json,
            },
        }

        self.requests.append(rv)
        return rv

    def to_json(self):
        """Convert the current scenario into a dict
        """
        doc = extract_documentation(self.func)
        title, text, warning, params = parse_doc_string(doc)
        return {
            "ident": self.ident,
            "requests": self.requests,
            "title": title,
            "text": text,
            "params": params,
            "warning": warning,
        }
