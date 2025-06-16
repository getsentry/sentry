from typing import TypeAlias

from sentry.pipeline.base import Pipeline
from sentry.pipeline.provider import PipelineProvider
from sentry.pipeline.store import PipelineSessionStore
from sentry.pipeline.views.base import PipelineView
from sentry.users.models.identity import IdentityProvider

IdentityPipelineT: TypeAlias = Pipeline[IdentityProvider, PipelineSessionStore]
IdentityPipelineProviderT: TypeAlias = PipelineProvider[IdentityProvider, PipelineSessionStore]
IdentityPipelineViewT: TypeAlias = PipelineView[IdentityProvider, PipelineSessionStore]
