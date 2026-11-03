from collections.abc import Callable, Sequence

from sentry.identity.base import Provider
from sentry.identity.pipeline import IdentityPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.pipeline.views.base import PipelineView


class DiscordIdentityProvider(Provider):
    key = IntegrationProviderSlug.DISCORD.value
    name = "Discord"

    def get_pipeline_views(
        self,
    ) -> Sequence[PipelineView[IdentityPipeline] | Callable[[], PipelineView[IdentityPipeline]]]:
        return []
