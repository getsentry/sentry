from typing import Optional

from sentry.sentry_metrics.client.kafka import build_mri
from sentry.sentry_metrics.use_case_id_registry import UseCaseID


class GenericMetricsTestMixIn:
    use_case_id = UseCaseID.TRANSACTIONS
    org_id = 2
    project_id = 1
    metric_name = "measurements.speed"
    set_values = [5, 3]
    counter_value = 5
    dist_values = [5, 3]
    metrics_tags = {"a": "b"}
    retention_days = 90
    unit = "millisecond"

    def get_mri(
        self, metric_name: str, metric_type: str, use_case_id: UseCaseID, unit: Optional[str]
    ):
        mri_string = build_mri(metric_name, metric_type, use_case_id, unit)

        return mri_string
