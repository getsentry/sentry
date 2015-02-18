from __future__ import absolute_import, print_function

from django.conf import settings

from sentry.plugins import Plugin2

from .processor import SourceProcessor


class JavascriptEventProcessor(object):
    def __call__(self, data):
        if data.get('platform') != 'javascript':
            return

        processor = SourceProcessor()
        return processor.process(data)


class JavascriptPlugin(Plugin2):
    def get_event_preprocessors(self, **kwargs):
        if not settings.SENTRY_SCRAPE_JAVASCRIPT_CONTEXT:
            return []
        return [JavascriptEventProcessor()]
