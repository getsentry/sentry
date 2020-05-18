from __future__ import absolute_import, print_function

from sentry import analytics


class IntegrationPipelineStep(analytics.Event):
    type = "integrations.pipeline_step"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("integration"),
        analytics.Attribute("step_index"),
        analytics.Attribute("pipeline_type"),
    )


analytics.register(IntegrationPipelineStep)
