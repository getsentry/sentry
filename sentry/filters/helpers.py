"""
sentry.filters.helpers
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

# Widget api is pretty ugly
from __future__ import absolute_import

__all__ = ('get_filters',)

import logging

from sentry.conf import settings
from sentry.plugins import plugins


FILTER_CACHE = {}


def get_filters(model=None, project=None):
    filter_list = []

    # Add builtins (specified with the FILTERS setting)
    for class_path in settings.FILTERS:
        if class_path not in FILTER_CACHE:
            module_name, class_name = class_path.rsplit('.', 1)
            try:
                module = __import__(module_name, {}, {}, class_name)
                cls = getattr(module, class_name)
            except Exception:
                logger = logging.getLogger('sentry.errors.filters')
                logger.exception('Unable to import %s' % (class_path,))
                continue
            FILTER_CACHE[class_path] = cls
        filter_list.append(FILTER_CACHE[class_path])

    # Add plugin-provided filters
    for plugin in plugins.all():
        if not plugin.is_enabled(project):
            continue

        for filter_cls in plugin.get_filters(project):
            if filter_cls not in filter_list:
                filter_list.append(filter_cls)

    # yield all filters which support ``model``
    for filter_cls in filter_list:
        if model and model not in filter_cls.types:
            continue
        yield filter_cls
