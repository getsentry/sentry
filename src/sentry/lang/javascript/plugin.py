from __future__ import absolute_import, print_function

from django.conf import settings
from ua_parser.user_agent_parser import Parse

from sentry.models import Project
from sentry.plugins import Plugin2
from sentry.utils import metrics

from .processor import SourceProcessor
from .errormapping import rewrite_exception


def preprocess_event(data):
    if settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT:
        project = Project.objects.get_from_cache(
            id=data['project'],
        )

        allow_scraping = bool(project.get_option('sentry:scrape_javascript', True))

        processor = SourceProcessor(
            project=project,
            allow_scraping=allow_scraping,
        )
        with metrics.timer('sourcemaps.process', instance=project.id):
            processor.process(data)

    rewrite_exception(data)

    inject_device_data(data)

    return data


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
    return '.'.join(value for value in [
        user_agent['major'],
        user_agent['minor'],
        user_agent.get('patch'),
    ] if value) or None


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
        if data.get('platform') == 'javascript':
            return [preprocess_event]
        return []
