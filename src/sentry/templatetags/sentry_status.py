from __future__ import absolute_import, print_function

from django import template

from sentry import status_checks

register = template.Library()


@register.inclusion_tag('sentry/partial/system-status.html', takes_context=True)
def show_system_status(context):
    problems, _ = status_checks.check_all()

    return {
        'problems': problems,
    }
