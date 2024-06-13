from collections.abc import Sequence
from typing import Any

from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.exceptions import InvalidParams
from sentry.models.project import Project
from sentry.sentry_metrics.extraction_rules import (
    MetricsExtractionRuleState,
    MetricsExtractionRuleValidationError,
    update_metrics_extraction_rules,
)


class MetricExtractionRulesSerializer(serializers.Serializer):
    span_attribute: str
    type: str
    unit: str
    tags: list[str]

    def validate(self, data: dict[str, str | list[str]]):
        self._validate_keys(data)
        self._validate_type(data["type"])
        self._validate_span_attribute(data["span_attribute"])
        self._validate_unit(data["unit"])
        self._validate_tags(data["tags"])

    def _validate_keys(self, data: dict[str, Any]) -> None:
        if data.keys() != {"span_attribute", "type", "unit", "tags"}:
            raise serializers.ValidationError(
                "Error: only 'span_attribute', 'type', 'unit' and 'tags' fields are allowed"
                "for the  metric extraction setting."
            )

    def _validate_type(self, input_type: str) -> None:
        allowed_metric_types = ("d", "s", "c")
        if input_type not in allowed_metric_types:
            raise serializers.ValidationError(
                "Error: metric must have one of the following types: 'd', 's', 'c'."
            )

    def _validate_tags(self, tags: list[str]) -> None:
        # check if tag exists on span
        # if tag does not exist, filter anyway but warn?
        pass

    def _validate_span_attribute(self, span_attribute: str) -> None:
        # validate than attribute exists on span
        # if attribute has never been sent, what do?
        pass

    def _validate_unit(self, unit: str) -> None:
        # do we have a regex for units somewhere?
        pass


@region_silo_endpoint
class ProjectMetricsExtractionRulesEndpoint(ProjectEndpoint):
    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL, "DELETE": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def _get_sanitized_tags(self, request: Request) -> Sequence[str]:
        tags = request.data.get("tags")
        if not tags:
            raise InvalidParams("You must supply at least one tag to block")

        # For now, we want to disallow any glob in the tags, since it might cause issues in Relay.
        return [tag.replace("*", "") for tag in tags]

    def _create_audit_log_entry(
        self, event_name: str, state: MetricsExtractionRuleState, project: Project
    ):
        raise NotImplementedError()

    def put(self, request: Request, project: Project) -> Response:
        #  validate / raise exceptions for malformed requests
        # try updating the project config
        # create audit log entry
        # if updating did not work, return 500
        # otherwise, return serialized response containing the entire new set of rules
        rules_update = request.data.get("metricsExtractionRules")

        for rule in rules_update:
            try:
                self.validate_rule(rule)
            except Exception:
                raise InvalidParams("Metrics extraction rule could not be validated.")
        try:
            persisted_rules = update_metrics_extraction_rules(project, rules_update)
            self._create_audit_log_entry(
                "UPDATE_METRICS_EXTRACTION_RULES", persisted_rules, project
            )

        except MetricsExtractionRuleValidationError:
            return Response(
                status=400,
                data={"detail": "Metrics extraction rule could not be validated successfully."},
            )
        except Exception as e:
            return Response(status=500, data={"detail": str(e)})

        return Response(serialize(persisted_rules, request.user, MetricExtractionRulesSerializer))

    def validate_rule(self, rule: None | dict[str, str | Sequence[str]]) -> None:
        if not rule:
            raise ValueError()
        pass

    def delete(self, request: Request, project: Project) -> Response:
        #  validate / raise exceptions for malformed requests
        # try updating the project config
        # create audit log entry
        # if updating did not work, return 500
        # otherwise, return serialized response containing the entire new set of rules
        metrics_extraction_rules = []
        return Response(
            serialize(metrics_extraction_rules, request.user, MetricExtractionRulesSerializer)
        )
