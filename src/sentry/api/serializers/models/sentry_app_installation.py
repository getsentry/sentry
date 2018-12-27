from __future__ import absolute_import


from sentry.api.serializers import Serializer, register
from sentry.models import SentryAppInstallation


@register(SentryAppInstallation)
class SentryAppInstallationSerializer(Serializer):
    def serialize(self, install, attrs, user):
        data = {
            'app': {
                'uuid': install.sentry_app.uuid,
                'slug': install.sentry_app.slug,
            },
            'organization': {
                'slug': install.organization.slug,
            },
            'uuid': install.uuid,
        }

        if install.is_new:
            data['code'] = install.api_grant.code

        return data
