from collections.abc import Sequence

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_extraction_rules import MetricsExtractionRuleSerializer
from sentry.models.project import Project
from sentry.sentry_metrics.extraction_rules import (
    MetricsExtractionRuleState,
    delete_metrics_extraction_rules,
    update_metrics_extraction_rules,
)


@region_silo_endpoint
class ProjectMetricsExtractionRulesEndpoint(ProjectEndpoint):
    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL, "DELETE": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def _create_audit_log_entry(
        self, event_name: str, state: MetricsExtractionRuleState, project: Project
    ):
        raise NotImplementedError()

    def put(self, request: Request, project: Project) -> Response:
        rules_update = request.data.get("metricsExtractionRules")
        if len(rules_update) == 0:
            return Response(status=200)

        try:
            persisted_rules = update_metrics_extraction_rules(project, rules_update)
            updated_rules = serialize(
                persisted_rules, request.user, MetricsExtractionRuleSerializer()
            )
        except Exception as e:
            return Response(status=500, data={"detail": str(e)})

        return Response(status=200, data=updated_rules)

    def validate_rule(self, rule: None | dict[str, str | Sequence[str]]) -> None:
        if not rule:
            raise ValueError()
        pass

    def delete(self, request: Request, project: Project) -> Response:
        rules_update = request.data.get("metricsExtractionRules")
        if len(rules_update) == 0:
            return Response(status=200)

        try:
            persisted_rules = delete_metrics_extraction_rules(project, rules_update)
            updated_rules = serialize(
                persisted_rules, request.user, MetricsExtractionRuleSerializer()
            )
        except Exception as e:
            return Response(status=500, data={"detail": str(e)})

        return Response(status=200, data=updated_rules)
