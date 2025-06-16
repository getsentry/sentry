from typing import Never, TypeAlias

from sentry.pipeline.base import Pipeline
from sentry.pipeline.provider import PipelineProvider
from sentry.pipeline.store import PipelineSessionStore
from sentry.pipeline.views.base import PipelineView

IntegrationPipelineT: TypeAlias = Pipeline[Never, PipelineSessionStore]
IntegrationPipelineProviderT: TypeAlias = PipelineProvider[Never, PipelineSessionStore]
IntegrationPipelineViewT: TypeAlias = PipelineView[Never, PipelineSessionStore]
