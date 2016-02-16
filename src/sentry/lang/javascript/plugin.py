from __future__ import absolute_import, print_function

from django.conf import settings

from sentry.models import Project
from sentry.plugins import Plugin2

from .processor import SourceProcessor


def preprocess_event(data):
    if data.get('platform') != 'javascript':
        return

    project = Project.objects.get_from_cache(
        id=data['project'],
    )

    allow_scraping = bool(project.get_option('sentry:scrape_javascript', True))

    processor = SourceProcessor(
        project=project,
        allow_scraping=allow_scraping,
    )
    return processor.process(data)


class JavascriptPlugin(Plugin2):
    can_disable = False

    def can_configure_for_project(self, project, **kwargs):
        return False

    def get_event_preprocessors(self, **kwargs):
        if not settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT:
            return []
        return [preprocess_event]
