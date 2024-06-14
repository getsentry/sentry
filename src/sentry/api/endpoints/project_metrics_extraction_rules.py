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
    delete_metrics_extraction_rules,
    update_metrics_extraction_rules,
)


@region_silo_endpoint
class ProjectMetricsExtractionRulesEndpoint(ProjectEndpoint):
    publish_status = {"PUT": ApiPublishStatus.EXPERIMENTAL, "DELETE": ApiPublishStatus.EXPERIMENTAL}
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def put(self, request: Request, project: Project) -> Response:
        rules_update = request.data.get("metricsExtractionRules")
        if not rules_update or len(rules_update) == 0:
            return Response(status=200)

        try:
            persisted_rules = update_metrics_extraction_rules(project, rules_update)
            updated_rules = serialize(
                persisted_rules, request.user, MetricsExtractionRuleSerializer()
            )
        except Exception as e:
            return Response(status=400, data={"detail": str(e)})

        return Response(status=200, data=updated_rules)

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
