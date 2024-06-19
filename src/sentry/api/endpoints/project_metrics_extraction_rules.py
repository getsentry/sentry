from collections.abc import Sequence
from typing import Any

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_extraction_rules import MetricsExtractionRuleSerializer
from sentry.models.project import Project
from sentry.sentry_metrics.extraction_rules import (
    MetricsExtractionRule,
    create_metrics_extraction_rules,
    delete_metrics_extraction_rules,
    get_metrics_extraction_rules,
    update_metrics_extraction_rules,
)


@region_silo_endpoint
class ProjectMetricsExtractionRulesEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE

    def has_feature(self, organization, request):
        return features.has(
            "organizations:custom-metrics-extraction-rule", organization, actor=request.user
        )

    def delete(self, request: Request, project: Project) -> Response:
        """DELETE an extraction rule in a project. Returns 204 No Data on success."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        rules_update = request.data.get("metricsExtractionRules") or []
        if len(rules_update) == 0:
            return Response(status=204)

        try:
            state_update = self._generate_deleted_rule_objects(rules_update)
            delete_metrics_extraction_rules(project, state_update)
        except Exception as e:
            return Response(status=500, data={"detail": str(e)})

        return Response(status=204)

    def get(self, request: Request, project: Project) -> Response:
        """GET extraction rules for project. Returns 200 and a list of extraction rules on success."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        try:
            extraction_rules = get_metrics_extraction_rules(project)
        except Exception as e:
            return Response(status=500, data={"detail": str(e)})

        return self.paginate(
            request,
            queryset=extraction_rules,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(
                x, user=request.user, serializer=MetricsExtractionRuleSerializer()
            ),
            default_per_page=25,
        )

    def post(self, request: Request, project: Project) -> Response:
        """POST an extraction rule to create a resource."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        rules_update = request.data.get("metricsExtractionRules")

        if not rules_update or len(rules_update) == 0:
            return Response(
                status=400,
                data={"detail": "Please specify the metric extraction rule to be created."},
            )

        try:
            state_update = self._generate_updated_rule_objects(rules_update)
            persisted_rules = create_metrics_extraction_rules(project, state_update)
            updated_rules = serialize(
                persisted_rules, request.user, MetricsExtractionRuleSerializer()
            )
        except Exception as e:
            return Response(status=400, data={"detail": str(e)})

        return Response(status=200, data=updated_rules)

    def put(self, request: Request, project: Project) -> Response:
        """PUT to modify an existing extraction rule."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        rules_update = request.data.get("metricsExtractionRules")

        if not rules_update or len(rules_update) == 0:
            return Response(status=200)

        try:
            state_update = self._generate_updated_rule_objects(rules_update)
            persisted_rules = update_metrics_extraction_rules(project, state_update)
            updated_rules = serialize(
                persisted_rules, request.user, MetricsExtractionRuleSerializer()
            )
        except Exception as e:
            return Response(status=400, data={"detail": str(e)})

        return Response(status=200, data=updated_rules)

    def _generate_updated_rule_objects(
        self, updated_rules: list[dict[str, Any]]
    ) -> dict[str, MetricsExtractionRule]:
        state_update = {}
        for updated_rule in updated_rules:
            rule = MetricsExtractionRule.from_dict(updated_rule)
            mri = rule.generate_mri()
            state_update[mri] = rule

        return state_update

    def _generate_deleted_rule_objects(
        self, updated_rules: list[dict[str, Any]]
    ) -> Sequence[MetricsExtractionRule]:
        state_update = []
        for updated_rule in updated_rules:
            state_update.append(MetricsExtractionRule.from_dict(updated_rule))

        return state_update
