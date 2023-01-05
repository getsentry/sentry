from __future__ import annotations

from typing import Any, Iterable, List, Optional

from sentry.models.options.user_option import UserOption
from sentry.services.hybrid_cloud.user_option import (
    ApiUserOption,
    ApiUserOptionSet,
    UserOptionService,
)


class DatabaseBackedUserOptionService(UserOptionService):
    def delete_options(self, *, option_ids: List[int]) -> None:
        UserOption.objects.filter(id__in=option_ids).delete()  # type: ignore

    def set_option(
        self,
        *,
        user_id: int,
        value: Any,
        key: str,
        project_id: int | None = None,
        organization_id: int | None = None,
    ) -> None:
        UserOption.objects.set_value(  # type: ignore
            user=user_id,
            key=key,
            value=value,
            project_id=project_id,
            organization_id=organization_id,
        )

    def _serialize_user_option(self, op: UserOption) -> ApiUserOption:
        return ApiUserOption(
            id=op.id,
            user_id=op.user_id,
            value=op.value,
            key=op.key,
            project_id=op.project_id,
            organization_id=op.organization_id,
        )

    def query_options(
        self,
        *,
        user_ids: Iterable[int],
        keys: List[str] | None = None,
        key: str | None = None,
        project_id: Optional[int] = None,
        organization_id: Optional[int] = None,
    ) -> ApiUserOptionSet:
        queryset = UserOption.objects.filter(  # type: ignore
            user_id__in=user_ids,
            project_id=project_id,
            organization_id=organization_id,
        )
        if keys is not None or key is not None:
            if keys is None:
                keys = []
            if key is not None:
                keys = [*keys, key]
            queryset = queryset.filter(
                key__in=keys,
            )
        return ApiUserOptionSet([self._serialize_user_option(op) for op in queryset])

    def close(self) -> None:
        pass
