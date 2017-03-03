from __future__ import absolute_import, print_function

import itertools

from django import template

from sentry import status_checks

register = template.Library()


@register.inclusion_tag('sentry/partial/system-status.html', takes_context=True)
def show_system_status(context):
    problems = list(itertools.chain.from_iterable(status_checks.check_all().values()))

    return {
        'problems': problems,
    }
