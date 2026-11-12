from sentry.seer.models.workflow import SeerWorkflowConfig, SeerWorkflowStrategy
from sentry.seer.workflows.breached_metrics import BreachedMetricWorkflow
from sentry.seer.workflows.workflow import SeerWorkflow

WORKFLOW_CLASSES: dict[SeerWorkflowStrategy, type[SeerWorkflow]] = {
    SeerWorkflowStrategy.BREACHED_METRIC_INVESTIGATION: BreachedMetricWorkflow,
}


def get_seer_workflow(config: SeerWorkflowConfig) -> SeerWorkflow:
    """Build the workflow class that implements the config's strategy."""
    workflow_cls = WORKFLOW_CLASSES.get(SeerWorkflowStrategy(config.strategy), SeerWorkflow)
    return workflow_cls(config_id=config.id, organization_id=config.organization_id)
