from __future__ import absolute_import

import sentry

from django import template
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages import get_messages
from pkg_resources import parse_version

from sentry import features, options
from sentry.api.serializers.base import serialize
from sentry.api.serializers.models.user import DetailedUserSerializer
from sentry.auth.superuser import is_active_superuser
from sentry.utils import auth, json
from sentry.utils.email import is_smtp_enabled
from sentry.utils.assets import get_asset_url
from sentry.utils.support import get_support_mail
from sentry.templatetags.sentry_dsn import get_public_dsn

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


def _needs_upgrade():
    version_configured = options.get('sentry:version-configured')
    if not version_configured:
        # If we were never previously upgraded (being a new install)
        # we want to force an upgrade, even if the values are set.
        return True

    smtp_disabled = not is_smtp_enabled()

    # Check all required options to see if they've been set
    for key in options.filter(flag=options.FLAG_REQUIRED):
        # ignore required flags which can be empty
        if key.flags & options.FLAG_ALLOW_EMPTY:
            continue
        # Ignore mail.* keys if smtp is disabled
        if smtp_disabled and key.name[:5] == 'mail.':
            continue
        if not options.isset(key.name):
            return True

    if version_configured != sentry.get_version():
        # Everything looks good, but version changed, so let's bump it
        options.set('sentry:version-configured', sentry.get_version())

    return False


def _get_statuspage():
    id = settings.STATUS_PAGE_ID
    if id is None:
        return None
    return {'id': id, 'api_host': settings.STATUS_PAGE_API_HOST}


@register.simple_tag(takes_context=True)
def get_react_config(context):
    if 'request' in context:
        request = context['request']
        user = getattr(request, 'user', None) or AnonymousUser()
        messages = get_messages(request)
        session = getattr(request, 'session', None)
        is_superuser = is_active_superuser(request)
    else:
        user = None
        messages = []
        is_superuser = False

    enabled_features = []
    if features.has('organizations:create', actor=user):
        enabled_features.append('organizations:create')
    if auth.has_user_registration():
        enabled_features.append('auth:register')

    version_info = _get_version_info()

    needs_upgrade = False

    if is_superuser:
        needs_upgrade = _needs_upgrade()

    context = {
        'singleOrganization': settings.SENTRY_SINGLE_ORGANIZATION,
        'supportEmail': get_support_mail(),
        'urlPrefix': options.get('system.url-prefix'),
        'version': version_info,
        'features': enabled_features,
        'mediaUrl': get_asset_url('sentry', ''),
        'needsUpgrade': needs_upgrade,
        'dsn': get_public_dsn(),
        'statuspage': _get_statuspage(),
        'messages': [{
            'message': msg.message,
            'level': msg.tags,
        } for msg in messages],
        'isOnPremise': settings.SENTRY_ONPREMISE,
        'invitesEnabled': settings.SENTRY_ENABLE_INVITES,
        'gravatarBaseUrl': settings.SENTRY_GRAVATAR_BASE_URL,
        'termsUrl': settings.TERMS_URL,
        'privacyUrl': settings.PRIVACY_URL,
        # Note `lastOrganization` should not be expected to update throughout frontend app lifecycle
        # It should only be used on a fresh browser nav to a path where an
        # organization is not in context
        'lastOrganization': session['activeorg'] if session and 'activeorg' in session else None,
    }
    if user and user.is_authenticated():
        context.update({
            'isAuthenticated': True,
            'user': serialize(user, user, DetailedUserSerializer()),
        })
        context['user']['isSuperuser'] = is_superuser
    else:
        context.update({
            'isAuthenticated': False,
            'user': None,
        })
    return json.dumps_htmlsafe(context)
