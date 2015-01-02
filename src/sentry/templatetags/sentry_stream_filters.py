"""
sentry.templatetags.sentry_stream_filters
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import logging

from django import template
from django.conf import settings
from sentry.constants import TAG_LABELS
from sentry.filters.base import Filter
from sentry.utils.imports import import_string

register = template.Library()


@register.filter
def get_filters(project, request):
    filter_list = []

    for class_path in settings.SENTRY_FILTERS:
        try:
            filter_cls = import_string(class_path)
        except Exception:
            logger = logging.getLogger('sentry.errors')
            logger.exception('Unable to import %s', class_path)
            continue
        filter_list.append(filter_cls(request, project))

    for tag in project.get_tags():
        filter_list.append(Filter(
            column=tag,
            label=TAG_LABELS.get(tag) or tag.replace('_', ' ').title(),
            request=request,
            project=project,
        ))

    return filter_list
