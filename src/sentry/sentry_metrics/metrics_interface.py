from typing import Mapping

from sentry_metrics.use_case_id_registry import UseCaseID


class GenericMetricsBackend:
    def counter(
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ) -> None:
        raise NotImplementedError

    def set(
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ) -> None:
        raise NotImplementedError

    def distribution(
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ) -> None:
        raise NotImplementedError
