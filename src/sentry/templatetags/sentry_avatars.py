from __future__ import absolute_import

from django import template
from django.conf import settings
from django.core.urlresolvers import reverse
from six.moves.urllib.parse import urlencode
from templatetag_sugar.parser import Constant, Optional, Variable
from templatetag_sugar.register import tag

from sentry.models import User, UserAvatar
from sentry.utils.avatar import (get_email_avatar, get_gravatar_url, get_letter_avatar)

register = template.Library()


# Adapted from http://en.gravatar.com/site/implement/images/django/
# The "mm" default is for the grey, "mystery man" icon. See:
#   http://en.gravatar.com/site/implement/images/
@tag(
    register, [
        Variable('email'),
        Optional([Constant('size'), Variable('size')]),
        Optional([Constant('default'), Variable('default')])
    ]
)
def gravatar_url(context, email, size=None, default='mm'):
    return get_gravatar_url(email, size, default)


@tag(
    register, [
        Variable('display_name'),
        Variable('identifier'),
        Optional([Constant('size'), Variable('size')])
    ]
)
def letter_avatar_svg(context, display_name, identifier, size=None):
    return get_letter_avatar(display_name, identifier, size=size)


@tag(register, [Variable('user_id'), Optional([Constant('size'), Variable('size')])])
def profile_photo_url(context, user_id, size=None):
    try:
        avatar = UserAvatar.objects.get_from_cache(user=user_id)
    except UserAvatar.DoesNotExist:
        return
    url = reverse('sentry-user-avatar-url', args=[avatar.ident])
    if size:
        url += '?' + urlencode({'s': size})
    return settings.SENTRY_URL_PREFIX + url


# Don't use this in any situations where you're rendering more
# than 1-2 avatars. It will make a request for every user!
@tag(
    register, [
        Variable('display_name'),
        Variable('identifier'),
        Optional([Constant('size'), Variable('size')]),
        Optional([Constant('try_gravatar'), Variable('try_gravatar')])
    ]
)
def email_avatar(context, display_name, identifier, size=None, try_gravatar=True):
    return get_email_avatar(display_name, identifier, size, try_gravatar)


@register.inclusion_tag('sentry/partial/avatar.html')
def avatar(user, size=36):
    # user can be User or OrganizationMember
    if isinstance(user, User):
        user_id = user.id
        email = user.email
    else:
        user_id = user.user_id
        email = user.email
        if user_id:
            email = user.user.email
    return {
        'email': email,
        'user_id': user_id,
        'size': size,
        'avatar_type': user.get_avatar_type(),
        'display_name': user.get_display_name(),
        'label': user.get_label(),
    }


@register.inclusion_tag('sentry/partial/avatar.html')
def avatar_for_email(user, size=36):
    # user can be User or OrganizationMember
    if isinstance(user, User):
        user_id = user.id
        email = user.email
    else:
        user_id = user.user_id
        email = user.email
        if user_id:
            email = user.user.email
    return {
        'for_email': True,
        'email': email,
        'user_id': user_id,
        'size': size,
        'avatar_type': user.get_avatar_type(),
        'display_name': user.get_display_name(),
        'label': user.get_label(),
    }
