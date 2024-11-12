from typing import Any

from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import EventLifecycleOutcome


def assert_metrics_gathered(
    expected_metric_type: EventLifecycleOutcome,
    domain: IntegrationDomain,
    integration_name: str,
    interaction_type: str,
    metrics_mock: Any,
):
    slo_name = f"integrations.slo.{expected_metric_type}"
    expected_tags = {
        "integration_domain": str(domain),
        "integration_name": integration_name,
        "interaction_type": interaction_type,
    }

    metrics_mock.assert_any_call(slo_name, tags=expected_tags, sample_rate=1.0)
