from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.doc_integrations import DocIntegrationBaseEndpoint
from sentry.models import DocIntegrationAvatar


class DocIntegrationAvatarEndpoint(AvatarMixin, DocIntegrationBaseEndpoint):
    object_type = "doc_integration"
    model = DocIntegrationAvatar

    def get_avatar_filename(self, obj):
        return f"{obj.slug}.png"
