from __future__ import absolute_import, print_function

from ua_parser.user_agent_parser import Parse

from sentry.plugins import Plugin2
from sentry.stacktraces import find_stacktraces_in_data

from .processor import JavaScriptStacktraceProcessor
from .errormapping import rewrite_exception
from .errorlocale import translate_exception


def preprocess_event(data):
    rewrite_exception(data)
    translate_exception(data)
    fix_culprit(data)
    if data.get('platform') == 'javascript':
        inject_device_data(data)
    generate_modules(data)
    return data


def generate_modules(data):
    from sentry.lang.javascript.processor import generate_module

    for info in find_stacktraces_in_data(data):
        for frame in info.stacktrace['frames']:
            platform = frame.get('platform') or data['platform']
            if platform not in ('javascript', 'node') or frame.get('module'):
                continue
            abs_path = frame.get('abs_path')
            if abs_path and abs_path.startswith(('http:', 'https:', 'webpack:', 'app:')):
                frame['module'] = generate_module(abs_path)


def fix_culprit(data):
    exc = data.get('sentry.interfaces.Exception')
    if not exc:
        return

    from sentry.event_manager import generate_culprit
    data['culprit'] = generate_culprit(data)


def parse_user_agent(data):
    http = data.get('sentry.interfaces.Http')
    if not http:
        return None

    headers = http.get('headers')
    if not headers:
        return None

    for key, value in headers:
        if key != 'User-Agent':
            continue
        ua = Parse(value)
        if not ua:
            continue
        return ua
    return None


def _get_version(user_agent):
    return '.'.join(
        value for value in [
            user_agent['major'],
            user_agent['minor'],
            user_agent.get('patch'),
        ] if value
    ) or None


def inject_browser_context(data, user_agent):
    ua = user_agent['user_agent']
    try:
        if ua['family'] == 'Other':
            return
        data['contexts']['browser'] = {
            'name': ua['family'],
            'version': _get_version(ua),
        }
    except KeyError:
        pass


def inject_os_context(data, user_agent):
    ua = user_agent['os']
    try:
        if ua['family'] == 'Other':
            return
        data['contexts']['os'] = {
            'name': ua['family'],
            'version': _get_version(ua),
        }
    except KeyError:
        pass


def inject_device_context(data, user_agent):
    ua = user_agent['device']
    try:
        if ua['family'] == 'Other':
            return
        data['contexts']['device'] = {
            'family': ua['family'],
            'model': ua['model'],
            'brand': ua['brand'],
        }
    except KeyError:
        pass


def inject_device_data(data):
    user_agent = parse_user_agent(data)
    if not user_agent:
        return

    data.setdefault('contexts', {})

    inject_browser_context(data, user_agent)
    inject_os_context(data, user_agent)
    inject_device_context(data, user_agent)


class JavascriptPlugin(Plugin2):
    can_disable = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_event_preprocessors(self, data, **kwargs):
        # XXX: rewrite_exception we probably also want if the event
        # platform is something else? unsure
        if data.get('platform') in ('javascript', 'node'):
            return [preprocess_event]
        return []

    def get_stacktrace_processors(self, data, stacktrace_infos, platforms, **kwargs):
        if 'javascript' in platforms or 'node' in platforms:
            return [JavaScriptStacktraceProcessor]
