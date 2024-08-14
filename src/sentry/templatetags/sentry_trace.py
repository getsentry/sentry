import sentry_sdk
from django import template

register = template.Library()


@register.simple_tag
def get_sentry_trace():
    return sentry_sdk.get_traceparent()


@register.simple_tag
def get_sentry_baggage():
    return sentry_sdk.get_baggage()
