from typing import Mapping

from sentry_metrics.metrics_interface import GenericMetricsBackend

from sentry.sentry_metrics.use_case_id_registry import UseCaseID


class KafkaGenericMetricsBackend(GenericMetricsBackend):
    def __init__(self) -> None:
        super().__init__()

    def counter(
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ):
        pass

    def set(
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ):
        pass

    def distribution(
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ):
        pass
