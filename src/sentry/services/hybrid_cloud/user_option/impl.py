from __future__ import annotations

from typing import Any, Callable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers.base import Serializer
from sentry.models.options.user_option import UserOption
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl
from sentry.services.hybrid_cloud.user_option import (
    RpcUserOption,
    UserOptionFilterArgs,
    UserOptionService,
)


class DatabaseBackedUserOptionService(
    FilterQueryDatabaseImpl[UserOption, UserOptionFilterArgs, RpcUserOption, None],
    UserOptionService,
):
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

    def _base_query(self) -> QuerySet:
        return UserOption.objects  # type: ignore

    def _filter_arg_validator(self) -> Callable[[UserOptionFilterArgs], Optional[str]]:
        return self._filter_has_any_key_validator("user_ids")

    def _serialize_api(self, serializer: Optional[None]) -> Serializer:
        # User options should not be serialized in this way
        raise NotImplementedError

    def _apply_filters(self, query: QuerySet, filters: UserOptionFilterArgs) -> QuerySet:
        # To maintain expected behaviors, we default these to None and always query for them
        project_id = None
        if "project_id" in filters:
            project_id = filters["project_id"]
        organization_id = None
        if "organization_id" in filters:
            organization_id = filters["organization_id"]

        query = query.filter(
            user_id__in=filters["user_ids"],
            project_id=project_id,
            organization_id=organization_id,
        )

        if "keys" in filters or "key" in filters:
            keys: List[str] = []
            if "keys" in filters:
                keys = filters["keys"]
            if "key" in filters:
                keys.append(filters["key"])
            query = query.filter(
                key__in=keys,
            )
        return query

    def _serialize_rpc(self, op: UserOption) -> RpcUserOption:
        return RpcUserOption(
            id=op.id,
            user_id=op.user_id,
            value=op.value,
            key=op.key,
            project_id=op.project_id,
            organization_id=op.organization_id,
        )

    def close(self) -> None:
        pass
