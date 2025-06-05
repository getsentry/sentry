from sentry import analytics


@analytics.eventclass("integrations.pipeline_step")
class IntegrationPipelineStep(analytics.Event):
    user_id: str
    organization_id: str
    integration: str
    step_index: str
    pipeline_type: str


analytics.register(IntegrationPipelineStep)
