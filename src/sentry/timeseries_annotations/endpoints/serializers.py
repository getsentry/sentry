from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from django.contrib.auth.models import AnonymousUser
from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.timeseries_annotations.models import (
    AnnotationScope,
    AnnotationType,
    IntervalType,
    Severity,
    TimeseriesAnnotation,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.viewer_context import ActorType

_INTERVAL_LABELS = dict(IntervalType.as_choices())
_SCOPE_LABELS = dict(AnnotationScope.as_choices())
_TYPE_LABELS = dict(AnnotationType.as_choices())
_SEVERITY_LABELS = dict(Severity.as_choices())

_INTERVAL_BY_LABEL = {label: value for value, label in IntervalType.as_choices()}
_SCOPE_BY_LABEL = {label: value for value, label in AnnotationScope.as_choices()}
_TYPE_BY_LABEL = {label: value for value, label in AnnotationType.as_choices()}
_SEVERITY_BY_LABEL = {label: value for value, label in Severity.as_choices()}


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
            "environmentId": (str(obj.environment_id) if obj.environment_id is not None else None),
            "startTimestamp": obj.start_timestamp,
            "endTimestamp": obj.end_timestamp,
            "intervalType": _INTERVAL_LABELS[obj.interval_type],
            "annotationType": _TYPE_LABELS[obj.annotation_type],
            "scope": _SCOPE_LABELS[obj.scope],
            "severity": _SEVERITY_LABELS[obj.severity],
            "description": obj.description,
            "tags": obj.tags,
            "createdBy": created_by,
            "createdByLabel": obj.created_by_label,
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }


class TimeseriesAnnotationPostSerializer(serializers.Serializer):
    annotationType = serializers.ChoiceField(choices=sorted(_TYPE_BY_LABEL))
    description = serializers.CharField()
    startTimestamp = serializers.DateTimeField()
    endTimestamp = serializers.DateTimeField(required=False, allow_null=True)
    scope = serializers.ChoiceField(choices=sorted(_SCOPE_BY_LABEL), default="global")
    severity = serializers.ChoiceField(choices=sorted(_SEVERITY_BY_LABEL), default="low")
    projectId = serializers.IntegerField(required=False, allow_null=True)
    tags = serializers.DictField(required=False, allow_null=True)

    def validate_annotationType(self, value: str) -> AnnotationType:
        return AnnotationType(_TYPE_BY_LABEL[value])

    def validate_scope(self, value: str) -> AnnotationScope:
        return AnnotationScope(_SCOPE_BY_LABEL[value])

    def validate_severity(self, value: str) -> Severity:
        return Severity(_SEVERITY_BY_LABEL[value])

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        end = attrs.get("endTimestamp")
        if end is not None and end < attrs["startTimestamp"]:
            raise serializers.ValidationError("endTimestamp must be at or after startTimestamp")
        return attrs
