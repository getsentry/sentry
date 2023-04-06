from abc import ABC, abstractmethod
from typing import Mapping

from sentry.sentry_metrics.use_case_id_registry import UseCaseID


class GenericMetricsBackend(ABC):
    @abstractmethod
    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ) -> None:
        raise NotImplementedError()

    @abstractmethod
    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ) -> None:
        raise NotImplementedError()

    @abstractmethod
    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: int,
        tags: Mapping[str, str],
    ) -> None:
        raise NotImplementedError()
