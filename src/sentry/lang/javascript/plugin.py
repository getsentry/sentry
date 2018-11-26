from __future__ import absolute_import, print_function

from sentry.plugins import Plugin2
from sentry.stacktraces import find_stacktraces_in_data
from sentry.utils.safe import get_path

from .processor import JavaScriptStacktraceProcessor
from .errormapping import rewrite_exception
from .errorlocale import translate_exception


def preprocess_event(data):
    rewrite_exception(data)
    translate_exception(data)
    fix_culprit(data)
    generate_modules(data)
    return data


def generate_modules(data):
    from sentry.lang.javascript.processor import generate_module

    for info in find_stacktraces_in_data(data):
        for frame in get_path(info.stacktrace, 'frames', filter=True, default=()):
            platform = frame.get('platform') or data['platform']
            if platform not in ('javascript', 'node') or frame.get('module'):
                continue
            abs_path = frame.get('abs_path')
            if abs_path and abs_path.startswith(('http:', 'https:', 'webpack:', 'app:')):
                frame['module'] = generate_module(abs_path)


def fix_culprit(data):
    if not get_path(data, 'exception', 'values', filter=True):
        return

    from sentry.event_manager import generate_culprit
    data['culprit'] = generate_culprit(data)


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
