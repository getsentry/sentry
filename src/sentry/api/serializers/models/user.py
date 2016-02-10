from __future__ import absolute_import

from django.conf import settings

from sentry.api.serializers import Serializer, register
from sentry.models import User, UserOption
from sentry.utils.avatar import get_gravatar_url


@register(User)
class UserSerializer(Serializer):
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
        return d
