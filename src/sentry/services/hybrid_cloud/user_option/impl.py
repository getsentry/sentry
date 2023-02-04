from __future__ import annotations

from typing import Any, Callable, Iterable, List, Optional

from django.db.models import QuerySet

from sentry.api.serializers.base import Serializer
from sentry.models.options.user_option import UserOption
from sentry.services.hybrid_cloud.filter_query import FilterQueryDatabaseImpl
from sentry.services.hybrid_cloud.user_option import (
    ApiUserOption,
    ApiUserOptionSet,
    UserOptionFilterArgs,
    UserOptionService,
)


class DatabaseBackedUserOptionService(
    FilterQueryDatabaseImpl[UserOption, UserOptionFilterArgs, ApiUserOption, None],
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
        return UserOption.objects

    def _filter_arg_validator(self) -> Callable[[UserOptionFilterArgs], Optional[str]]:
        # A validation function for filter arguments. Often just:
        #
        # return self._filter_has_any_key_validator( ... )
        return self._filter_has_any_key_validator("user_ids")

    def _serialize_api(self, serializer: Optional[None]) -> Serializer:
        # User options should not be serialized in this way
        raise NotImplementedError

    def _apply_filters(self, query: QuerySet, filters: UserOptionFilterArgs) -> QuerySet:
        # To maintain expected behaviors, we default this to None and always query for them
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
            keys = []
            if filters.get("keys", None):
                keys = filters["keys"]
            if filters.get("key", None):
                keys.append(filters["key"])
            query = query.filter(
                key__in=keys,
            )
        return query

    def _serialize_rpc(self, op: UserOption) -> ApiUserOption:
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
        return ApiUserOptionSet([self._serialize_rpc(op) for op in queryset])

    def close(self) -> None:
        pass
