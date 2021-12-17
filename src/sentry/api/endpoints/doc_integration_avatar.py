from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.api.serializers.rest_framework.doc_integration import DocIntegrationAvatarSerializer
from sentry.models import DocIntegrationAvatar


class DocIntegrationAvatarEndpoint(AvatarMixin, DocIntegrationBaseEndpoint):
    object_type = "doc_integration"
    model = DocIntegrationAvatar
    serializer_cls = DocIntegrationAvatarSerializer

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.png"
