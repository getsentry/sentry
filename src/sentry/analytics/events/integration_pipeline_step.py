from sentry import analytics


@analytics.eventclass("integrations.pipeline_step")
class IntegrationPipelineStep(analytics.Event):
    user_id: int
    organization_id: int
    integration: str
    step_index: int
    pipeline_type: str


analytics.register(IntegrationPipelineStep)
