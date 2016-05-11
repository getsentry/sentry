from __future__ import absolute_import

from django.conf import settings

from sentry.api.serializers import Serializer, register
from sentry.models import User, UserAvatar, UserOption
from sentry.utils.avatar import get_gravatar_url


@register(User)
class UserSerializer(Serializer):
    def get_attrs(self, item_list, user):
        avatars = {
            a.user_id: a
            for a in UserAvatar.objects.filter(
                user__in=item_list
            )
        }
        return {u: {'avatar': avatars.get(u.id)} for u in item_list if u}

    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'name': obj.get_display_name(),
            'username': obj.username,
            'email': obj.email,
            'avatarUrl': get_gravatar_url(obj.email, size=32),
            'isActive': obj.is_active,
            'dateJoined': obj.date_joined,
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

        return d
