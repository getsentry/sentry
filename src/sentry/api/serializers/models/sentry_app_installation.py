from __future__ import absolute_import


from sentry.api.serializers import Serializer, register
from sentry.models import SentryAppInstallation


@register(SentryAppInstallation)
class SentryAppInstallationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        data = {
            'app': {
                'uuid': obj.sentry_app.uuid,
                'slug': obj.sentry_app.slug,
            },
            'organization': {
                'slug': obj.organization.slug,
            },
            'uuid': obj.uuid,
        }

        if 'code' in attrs:
            data['code'] = attrs['code']

        return data
