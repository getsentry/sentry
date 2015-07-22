from __future__ import absolute_import, print_function

from django import template
from time import time

from sentry import options

register = template.Library()

ERR_WORKERS_LONG_PING = "Background workers haven't checked in recently. This can mean an issue with your configuration or a serious backlog in tasks."


@register.inclusion_tag('sentry/partial/system-status.html', takes_context=True)
def show_system_status(context):
    problems = []

    last_ping = options.get('sentry:last_worker_ping') or 0
    if last_ping < time() - 300:
        problems.append(ERR_WORKERS_LONG_PING)

    return {
        'problems': problems,
    }
