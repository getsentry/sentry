from collections.abc import Mapping
from datetime import datetime
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.transaction_threshold import (
    TRANSACTION_METRICS,
    ProjectTransactionThreshold,
    ProjectTransactionThresholdOverride,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ProjectTransactionThresholdResponse(TypedDict):
    id: str
    threshold: str
    metric: str
    projectId: str
    editedBy: str
    dateUpdated: datetime
    dateAdded: datetime | None


class ProjectTransactionThresholdOverrideResponse(ProjectTransactionThresholdResponse):
    transaction: str


@register(ProjectTransactionThreshold)
class ProjectTransactionThresholdSerializer(Serializer[ProjectTransactionThresholdResponse]):
    def serialize(
        self,
        obj: ProjectTransactionThreshold,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser | None,
        **kwargs: object,
    ) -> ProjectTransactionThresholdResponse:
        return {
            "id": str(obj.id),
            "threshold": str(obj.threshold),
            "metric": TRANSACTION_METRICS[obj.metric],
            "projectId": str(obj.project_id),
            "editedBy": str(obj.edited_by_id),
            "dateUpdated": obj.date_updated,
            "dateAdded": obj.date_added,
        }


@register(ProjectTransactionThresholdOverride)
class ProjectTransactionThresholdOverrideSerializer(
    Serializer[ProjectTransactionThresholdOverrideResponse]
):
    def serialize(
        self,
        obj: ProjectTransactionThresholdOverride,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser | None,
        **kwargs: object,
    ) -> ProjectTransactionThresholdOverrideResponse:
        return {
            "id": str(obj.id),
            "threshold": str(obj.threshold),
            "metric": TRANSACTION_METRICS[obj.metric],
            "transaction": obj.transaction,
            "projectId": str(obj.project_id),
            "editedBy": str(obj.edited_by_id),
            "dateUpdated": obj.date_updated,
            "dateAdded": obj.date_added,
        }
