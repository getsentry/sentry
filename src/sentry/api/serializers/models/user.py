from __future__ import absolute_import

import six

from collections import defaultdict
from django.conf import settings

from sentry.app import env
from sentry.api.serializers import Serializer, register
from sentry.models import (
    AuthIdentity, Authenticator, User, UserAvatar, UserOption, UserEmail,
)
from sentry.utils.avatar import get_gravatar_url


@register(User)
class UserSerializer(Serializer):
    def _get_identities(self, item_list, user):
        if not (env.request and env.request.is_superuser()):
            item_list = [x for x in item_list if x == user]

        queryset = AuthIdentity.objects.filter(
            user__in=item_list,
        ).select_related('auth_provider', 'auth_provider__organization')

        results = {i.id: [] for i in item_list}
        for item in queryset:
            results[item.user_id].append(item)
        return results

    def _get_useremails(self, item_list, user):
        queryset = UserEmail.objects.filter(
            user__in=item_list,
        )

        results = {i.id: [] for i in item_list}
        for item in queryset:
            results[item.user_id].append(item)
        return results

    def get_attrs(self, item_list, user):
        avatars = {
            a.user_id: a
            for a in UserAvatar.objects.filter(
                user__in=item_list
            )
        }
        identities = self._get_identities(item_list, user)
        emails = self._get_useremails(item_list, user)

        authenticators = Authenticator.objects.bulk_users_have_2fa([i.id for i in item_list])

        data = {}
        for item in item_list:
            data[item] = {
                'avatar': avatars.get(item.id),
                'identities': identities.get(item.id),
                'has2fa': authenticators[item.id],
                'emails': emails[item.id],
            }
        return data

    def serialize(self, obj, attrs, user):
        d = {
            'id': six.text_type(obj.id),
            'name': obj.get_display_name(),
            'username': obj.username,
            'email': obj.email,
            'avatarUrl': get_gravatar_url(obj.email, size=32),
            'isActive': obj.is_active,
            'isManaged': obj.is_managed,
            'dateJoined': obj.date_joined,
            'lastLogin': obj.last_login,
            'has2fa': attrs['has2fa'],
        }

        if obj == user:
            options = {
                o.key: o.value
                for o in UserOption.objects.filter(
                    user=user,
                    project__isnull=True,
                )
            }
            stacktrace_order = int(options.get('stacktrace_order', -1) or -1)
            if stacktrace_order == -1:
                stacktrace_order = 'default'
            elif stacktrace_order == 2:
                stacktrace_order = 'newestFirst'
            elif stacktrace_order == 1:
                stacktrace_order = 'newestLast'

            d['options'] = {
                'language': options.get('language') or 'en',
                'stacktraceOrder': stacktrace_order,
                'timezone': options.get('timezone') or settings.SENTRY_DEFAULT_TIME_ZONE,
                'clock24Hours': options.get('clock_24_hours') or False,
            }

        if attrs.get('avatar'):
            avatar = {
                'avatarType': attrs['avatar'].get_avatar_type_display(),
                'avatarUuid': attrs['avatar'].ident if attrs['avatar'].file else None
            }
        else:
            avatar = {'avatarType': 'letter_avatar', 'avatarUuid': None}
        d['avatar'] = avatar

        if attrs['identities'] is not None:
            d['identities'] = [{
                'id': six.text_type(i.id),
                'name': i.ident,
                'organization': {
                    'slug': i.auth_provider.organization.slug,
                    'name': i.auth_provider.organization.name,
                },
                'provider': {
                    'id': i.auth_provider.provider,
                    'name': i.auth_provider.get_provider().name,
                },
                'dateSynced': i.last_synced,
                'dateVerified': i.last_verified,
            } for i in attrs['identities']]

        d['emails'] = [{
            'id': six.text_type(e.id),
            'email': e.email,
            'is_verified': e.is_verified,
        } for e in attrs['emails']]

        return d


class DetailedUserSerializer(UserSerializer):
    def get_attrs(self, item_list, user):
        attrs = super(DetailedUserSerializer, self).get_attrs(item_list, user)

        authenticators = defaultdict(list)
        queryset = Authenticator.objects.filter(
            user__in=item_list,
        )
        for auth in queryset:
            # ignore things that aren't user controlled (like recovery codes)
            if auth.interface.is_backup_interface:
                continue
            authenticators[auth.user_id].append(auth)

        for item in item_list:
            attrs[item]['authenticators'] = authenticators[item.id]

        return attrs

    def serialize(self, obj, attrs, user):
        d = super(DetailedUserSerializer, self).serialize(obj, attrs, user)
        d['authenticators'] = [{
            'id': six.text_type(a.id),
            'type': a.interface.interface_id,
            'name': a.interface.name,
            'dateCreated': a.created_at,
            'dateUsed': a.last_used_at,
        } for a in attrs['authenticators']]
        return d
