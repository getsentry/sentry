from __future__ import absolute_import, print_function

from django.conf import settings
from django import template

register = template.Library()


@register.filter
def auth_provider_label(provider):
    return settings.AUTH_PROVIDER_LABELS[provider]
