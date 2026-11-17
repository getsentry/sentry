from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    TimeseriesAnnotation,
)
from sentry.timeseries_annotations.utils import enum_labels
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.viewer_context import ActorType

_INTERVAL_LABELS = enum_labels(IntervalType)
_SCOPE_LABELS = enum_labels(AnnotationScope)
_TYPE_LABELS = enum_labels(AnnotationType)


@register(TimeseriesAnnotation)
class TimeseriesAnnotationSerializer(Serializer):
    def serialize(
        self,
        obj: TimeseriesAnnotation,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[str, Any]:
        if obj.created_by_id is not None:
            created_by = {"type": ActorType.USER, "id": str(obj.created_by_id)}
        elif obj.created_by_service_account_id is not None:
            created_by = {
                "type": ActorType.SERVICE_ACCOUNT,
                "id": str(obj.created_by_service_account_id),
            }
        else:
            created_by = None

        return {
            "id": str(obj.id),
            "organizationId": str(obj.organization_id),
            "projectId": str(obj.project_id) if obj.project_id is not None else None,
            "startTimestamp": obj.start_timestamp,
            "endTimestamp": obj.end_timestamp,
            "intervalType": _INTERVAL_LABELS[obj.interval_type],
            "annotationType": _TYPE_LABELS[obj.annotation_type],
            "scope": _SCOPE_LABELS[obj.scope],
            "description": obj.description,
            "tags": obj.tags,
            "createdBy": created_by,
            "createdByLabel": obj.created_by_label,
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
