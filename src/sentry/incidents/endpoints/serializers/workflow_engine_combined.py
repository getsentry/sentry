from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from typing import Any

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.rule import WorkflowEngineRuleSerializer
from sentry.incidents.endpoints.serializers.workflow_engine_detector import (
    WorkflowEngineDetectorSerializer,
)
from sentry.incidents.grouptype import MetricIssue
from sentry.monitors.models import Monitor
from sentry.uptime.endpoints.serializers import UptimeDetectorSerializer
from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.workflow_engine.models import Detector, Workflow


class WorkflowEngineCombinedRuleSerializer(Serializer):
    """
    Serializer for combined rules endpoint when using workflow engine.
    Dispatches to appropriate serializers based on object type.
    """

    def __init__(self, expand: list[str] | None = None):
        self.expand = expand or []

    def get_attrs(
        self, item_list: Sequence[Any], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> MutableMapping[Any, Any]:
        results = super().get_attrs(item_list, user)

        metric_detectors = [
            x for x in item_list if isinstance(x, Detector) and x.type == MetricIssue.slug
        ]
        workflows = [x for x in item_list if isinstance(x, Workflow)]
        uptime_detectors = [
            x
            for x in item_list
            if isinstance(x, Detector) and x.type == GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE
        ]
        cron_monitors = [x for x in item_list if isinstance(x, Monitor)]

        serialized_metric_detectors = serialize(
            metric_detectors,
            user=user,
            serializer=WorkflowEngineDetectorSerializer(expand=self.expand),
        )
        serialized_workflows = serialize(
            workflows,
            user=user,
            serializer=WorkflowEngineRuleSerializer(expand=self.expand),
        )
        serialized_uptime_detectors = serialize(
            uptime_detectors,
            user=user,
            serializer=UptimeDetectorSerializer(),
        )
        serialized_cron_monitors = serialize(cron_monitors, user=user)

        # Map by position since serializers return fake IDs that can't be used for lookup
        for detector, serialized in zip(metric_detectors, serialized_metric_detectors):
            results[detector] = serialized

        for workflow, serialized in zip(workflows, serialized_workflows):
            results[workflow] = serialized

        for detector, serialized in zip(uptime_detectors, serialized_uptime_detectors):
            results[detector] = serialized

        for monitor, serialized in zip(cron_monitors, serialized_cron_monitors):
            results[monitor] = serialized

        return results

    def serialize(
        self,
        obj: Detector | Workflow | Monitor,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Any, Any]:
        match obj:
            case Workflow():
                type_value = "rule"
            case Monitor():
                type_value = "monitor"
            case Detector(type=type_str) if type_str == MetricIssue.slug:
                type_value = "alert_rule"
            case Detector(type=type_str) if type_str == GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE:
                type_value = "uptime"
            case _:
                raise AssertionError(f"Invalid rule to serialize: {type(obj)}")

        return {**attrs, "type": type_value}
