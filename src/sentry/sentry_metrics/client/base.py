from __future__ import annotations

from typing import Dict, Optional, Sequence, Union

from sentry.sentry_metrics.use_case_id_registry import UseCaseID
from sentry.utils.services import Service


class GenericMetricsBackend(Service):
    def counter(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Union[int, float],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Used for emitting a counter metric for internal use cases only.
        Ensure that the use_case_id passed in has been registered
        in the UseCaseID enum.
        """

        raise NotImplementedError()

    def set(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[int],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Used for emitting a set metric for internal use cases only. Can support
        a sequence of values. Ensure that the use_case_id passed in has
        been registered in the UseCaseID enum.
        """
        raise NotImplementedError()

    def distribution(
        self,
        use_case_id: UseCaseID,
        org_id: int,
        project_id: int,
        metric_name: str,
        value: Sequence[Union[int, float]],
        tags: Dict[str, str],
        unit: Optional[str],
    ) -> None:

        """
        Used for emitting a distribution metric for internal use cases only. Can
        support a sequence of values. Ensure that the use_case_id passed in
        has been registered in the UseCaseID enum.
        """
        raise NotImplementedError()

    def close(self) -> None:
        """
        Calling this is not required and is mostly for usage in tests
        """
        raise NotImplementedError()
