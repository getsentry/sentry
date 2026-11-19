from collections.abc import Callable, Mapping, Sequence
from typing import Annotated, cast

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import serialize
from sentry.api.serializers.models.group import BaseGroupSerializerResponse, GroupSerializer
from sentry.api.serializers.models.userreport import (
    UserReportSerializer,
    UserReportSerializerResponse,
    _EventUser,
)
from sentry.apidocs.descriptions import ApiDescription
from sentry.models.environment import Environment
from sentry.models.group import Group
from sentry.models.userreport import UserReport
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class UserReportWithGroupSerializerResponse(UserReportSerializerResponse):
    issue: Annotated[
        BaseGroupSerializerResponse | None,
        ApiDescription(
            "Issue the feedback's event belongs to. Null when the feedback isn't linked to an issue"
        ),
    ]


class UserReportWithGroupSerializer(UserReportSerializer):
    def __init__(self, environment_func: Callable[[], Environment | None] | None = None) -> None:
        self.environment_func = environment_func

    def get_attrs(
        self,
        item_list: Sequence[UserReport],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> dict[UserReport, _EventUser]:
        groups = list(Group.objects.filter(id__in={i.group_id for i in item_list if i.group_id}))
        serialized_groups = {}
        if groups:
            serialized_groups = {
                d["id"]: d
                for d in serialize(
                    groups,
                    user,
                    GroupSerializer(environment_func=self.environment_func),
                )
            }

        attrs = super().get_attrs(item_list, user)
        for item in item_list:
            attrs[item].update(
                {"group": serialized_groups[str(item.group_id)] if item.group_id else None}
            )
        return attrs

    def serialize(
        self,
        obj: UserReport,
        attrs: Mapping[str, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> UserReportWithGroupSerializerResponse:
        context = super().serialize(obj, attrs, user)
        return {
            **context,
            "issue": cast(BaseGroupSerializerResponse | None, attrs["group"]),
        }
