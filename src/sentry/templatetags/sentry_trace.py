import sentry_sdk
from django import template

register = template.Library()


@register.simple_tag
def get_sentry_trace() -> str | None:
    return sentry_sdk.get_traceparent()


@register.simple_tag
def get_sentry_baggage() -> str | None:
    return sentry_sdk.get_baggage()
