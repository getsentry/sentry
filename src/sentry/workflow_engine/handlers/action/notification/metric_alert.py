from abc import ABC

import sentry_sdk

from sentry.utils.registry import Registry
from sentry.workflow_engine.models import Action, Detector
from sentry.workflow_engine.types import WorkflowJob


class BaseMetricAlertHandler(ABC):
    @classmethod
    def invoke_legacy_registry(
        cls,
        job: WorkflowJob,
        action: Action,
        detector: Detector,
    ) -> None:

        with sentry_sdk.start_span(
            op="workflow_engine.handlers.action.notification.metric_alert.invoke_legacy_registry"
        ):
            # TODO: Implement this
            pass


metric_alert_handler_registry = Registry[BaseMetricAlertHandler](enable_reverse_lookup=False)
