from sentry.api.serializers import Serializer, register
from sentry.constants import SentryAppInstallationStatus
from sentry.models import SentryAppInstallation


@register(SentryAppInstallation)
class SentryAppInstallationSerializer(Serializer):
    def serialize(self, install, attrs, user):
        data = {
            "app": {"uuid": install.sentry_app.uuid, "slug": install.sentry_app.slug},
            "organization": {"slug": install.organization.slug},
            "uuid": install.uuid,
            "status": SentryAppInstallationStatus.as_str(install.status),
        }

        if install.api_grant:
            data["code"] = install.api_grant.code

        return data
