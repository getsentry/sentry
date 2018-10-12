from __future__ import absolute_import


from sentry.api.serializers import Serializer, register
from sentry.models import SentryAppInstallation


@register(SentryAppInstallation)
class SentryAppInstallationSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        return {
            'app': obj.sentry_app,
            'organization': obj.organzation.slug,
            'uuid': obj.uuid,
        }
