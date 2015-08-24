import re
import json
import base64
import inspect
import requests

from django.conf import settings


optional_group_matcher = re.compile(r'\(\?\:(.+)\)')
named_group_matcher = re.compile(r'\(\?P<(\w+)>[^\)]+\)')
non_named_group_matcher = re.compile(r'\(.*?\)')


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

    # clean up any outstanding regex-y characters.
    pattern = pattern.replace('^', '').replace('$', '') \
        .replace('?', '').replace('//', '/').replace('\\', '')
    if not pattern.startswith('/'):
        pattern = '/' + pattern
    return pattern


def get_internal_endpoint_from_pattern(pattern):
    if not hasattr(pattern, 'callback'):
        return
    from sentry.api.base import Endpoint
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


def extract_endpoint_info(pattern, internal_endpoint):
    from sentry.constants import HTTP_METHODS
    path = simplify_regex(pattern.regex.pattern)
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
        title, text = extract_title_and_text(doc)
        yield dict(
            path=API_PREFIX + path.lstrip('/'),
            method=method_name,
            title=title,
            text=text,
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
        scenarios[ident] = f
        f.api_scenario_ident = ident
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


class Runner(object):
    """The runner is a special object that holds state for the automatic
    running of example scenarios.  It gets created by api-docs/generator.py
    which does the majority of the heavy lifting.  It mainly exists here
    so that the scenarios can be run separately if needed.
    """

    def __init__(self, vars, ident):
        self.vars = vars
        self.ident = ident
        self.requests = []

    def request(self, method, path, headers=None, data=None):
        path = '/api/0/' + path.lstrip('/')
        headers = dict(headers or {})
        req_headers = dict(headers)
        req_headers['Host'] = 'app.getsentry.com'
        req_headers['Authorization'] = 'Basic %s' % base64.b64encode('%s:' % (
            self.vars['api_key'].key.encode('utf-8')))

        body = None
        if data is not None:
            body = json.dumps(data, sort_keys=True)
            headers['Content-Type'] = 'application/json'

        url = 'http://127.0.0.1:%s%s' % (
            settings.SENTRY_APIDOCS_WEB_PORT,
            path,
        )

        response = requests.request(method=method, url=url,
                                    headers=req_headers, data=body)
        response_headers = dict(response.headers)
        # Don't want those
        response_headers.pop('server', None)
        response_headers.pop('date', None)

        rv = {
            'request': {
                'method': method,
                'path': path,
                'headers': headers,
                'data': data,
            },
            'response': {
                'headers': response_headers,
                'status': response.status_code,
                'reason': response.reason,
                'data': response.json(),
            }
        }

        self.requests.append(rv)
        return rv

    def to_json(self):
        return {
            'ident': self.ident,
            'requests': self.requests,
        }
