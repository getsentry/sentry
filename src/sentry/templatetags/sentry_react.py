from __future__ import absolute_import

import sentry

from django import template
from django.conf import settings
from django.utils.html import mark_safe
from django.contrib.messages import get_messages
from pkg_resources import parse_version

from sentry import features, options
from sentry.api.serializers.base import serialize
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.functional import extract_lazy_object

register = template.Library()


def _get_version_info():
    current = sentry.VERSION

    latest = options.get('sentry:latest_version') or current
    upgrade_available = parse_version(latest) > parse_version(current)
    build = sentry.__build__ or current

    return {
        'current': current,
        'latest': latest,
        'build': build,
        'upgradeAvailable': upgrade_available,
    }


@register.simple_tag(takes_context=True)
def get_react_config(context):
    if 'request' in context:
        user = context['request'].user
        messages = get_messages(context['request'])
        try:
            is_superuser = context['request'].is_superuser()
        except AttributeError:
            is_superuser = False
    else:
        user = None
        messages = []
        is_superuser = False

    if user:
        user = extract_lazy_object(user)

    enabled_features = []
    if features.has('organizations:create', actor=user):
        enabled_features.append('organizations:create')
    if features.has('auth:register', actor=user):
        enabled_features.append('auth:register')

    context = {
        'singleOrganization': settings.SENTRY_SINGLE_ORGANIZATION,
        'urlPrefix': settings.SENTRY_URL_PREFIX,
        'version': _get_version_info(),
        'features': enabled_features,
        'mediaUrl': get_asset_url('sentry', ''),
        'messages': [{
            'message': msg.message,
            'level': msg.tags,
        } for msg in messages],
    }
    if user and user.is_authenticated():
        context.update({
            'isAuthenticated': True,
            'user': serialize(user, user),
        })
        context['user']['isSuperuser'] = is_superuser
    else:
        context.update({
            'isAuthenticated': False,
            'user': None,
        })
    return mark_safe(json.dumps(context))
