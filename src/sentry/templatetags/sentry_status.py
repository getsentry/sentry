import itertools

from django import template

from sentry import status_checks
from sentry.status_checks import sort_by_severity

register = template.Library()


@register.inclusion_tag("sentry/partial/system-status.html", takes_context=True)
def show_system_status(context):
    problems = itertools.chain.from_iterable(status_checks.check_all().values())
    return {"problems": sort_by_severity(problems)}
