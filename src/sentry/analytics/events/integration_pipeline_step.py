from typing import int
from sentry import analytics


@analytics.eventclass("integrations.pipeline_step")
class IntegrationPipelineStep(analytics.Event):
    user_id: int | None = None
    organization_id: int
    integration: str
    step_index: int
    pipeline_type: str


analytics.register(IntegrationPipelineStep)
