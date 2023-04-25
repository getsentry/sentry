from abc import ABC, abstractmethod
from concurrent.futures import Future
from typing import Mapping, Optional, Sequence, Union

from sentry.sentry_metrics.use_case_id_registry import UseCaseID


class GenericMetricsBackend(ABC):
    @abstractmethod
    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Union[int, float],
        tags: Mapping[str, str],
        unit: Optional[str] = None,
        retention_days: Optional[int] = 90,
    ) -> Optional[Future[None]]:

        """
        Used for emitting a counter metric for internal use cases only.
        Ensure that the use_case_id passed in has been registered
        in the UseCaseID enum.
        """

        raise NotImplementedError()

    @abstractmethod
    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Mapping[str, str],
        unit: Optional[str] = None,
        retention_days: Optional[int] = 90,
    ) -> Optional[Future[None]]:

        """
        Used for emitting a set metric for internal use cases only. Can support
        a sequence of values. Ensure that the use_case_id passed in has
        been registered in the UseCaseID enum.
        """
        raise NotImplementedError()

    @abstractmethod
    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Mapping[str, str],
        unit: Optional[str] = None,
        retention_days: Optional[int] = 90,
    ) -> Optional[Future[None]]:

        """
        Used for emitting a distribution metric for internal use cases only. Can
        support a sequence of values. Ensure that the use_case_id passed in
        has been registered in the UseCaseID enum.
        """
        raise NotImplementedError()
