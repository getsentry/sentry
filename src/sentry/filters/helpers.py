"""
sentry.filters.helpers
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

# Widget api is pretty ugly
from __future__ import absolute_import

__all__ = ('get_filters',)

import logging

from django.conf import settings
from django.utils.translation import ugettext_lazy as _
from sentry.filters.base import TagFilter
from sentry.plugins import plugins
from sentry.utils.safe import safe_execute


FILTER_CACHE = {}
TAG_FILTER_CACHE = {}


def get_filters(model=None, project=None):
    filter_list = []

    # Add builtins (specified with the FILTERS setting)
    for class_path in settings.SENTRY_FILTERS:
        if class_path not in FILTER_CACHE:
            module_name, class_name = class_path.rsplit('.', 1)
            try:
                module = __import__(module_name, {}, {}, class_name)
                cls = getattr(module, class_name)
            except Exception:
                logger = logging.getLogger('sentry.errors.filters')
                logger.exception('Unable to import %s', class_path)
                continue
            FILTER_CACHE[class_path] = cls
        filter_list.append(FILTER_CACHE[class_path])

    if project:
        for tag in project.get_tags():
            if tag not in TAG_FILTER_CACHE:
                # Generate a new filter class because we are lazy and do
                # not want to rewrite code
                class new(TagFilter):
                    label = _(tag.replace('_', ' ').title())
                    column = tag
                new.__name__ = '__%sGeneratedFilter' % tag.encode('utf8')
                TAG_FILTER_CACHE[tag] = new
            filter_list.append(TAG_FILTER_CACHE[tag])

    # Add plugin-provided filters
    for plugin in plugins.for_project(project):
        results = safe_execute(plugin.get_filters, project)
        if results:
            for filter_cls in results:
                if filter_cls not in filter_list:
                    filter_list.append(filter_cls)

    # yield all filters which support ``model``
    for filter_cls in filter_list:
        yield filter_cls
