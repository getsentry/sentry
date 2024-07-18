import logging
from collections.abc import Generator
from contextlib import contextmanager

from django.db import IntegrityError, router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectMetricsExtractionRulesPermission
from sentry.api.exceptions import BadRequest, ConflictError
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_extraction_rules import (
    SpanAttributeExtractionRuleConfigSerializer,
)
from sentry.models.project import Project
from sentry.sentry_metrics.models import SpanAttributeExtractionRuleConfig
from sentry.sentry_metrics.span_attribute_extraction_rules import (
    create_extraction_rule_config,
    delete_extraction_rule_config,
    update_extraction_rule_config,
)
from sentry.tasks.relay import schedule_invalidate_project_config

logger = logging.getLogger("sentry.metric_extraction_rules")


class MetricsExtractionRuleValidationError(ValueError):
    pass


@contextmanager
def handle_exceptions() -> Generator[None, None, None]:
    try:
        yield
    except IntegrityError:
        raise ConflictError(detail="Resource already exists.")
    except KeyError as e:
        raise BadRequest(detail=f"Missing field in input data: {str(e)}")
    except MetricsExtractionRuleValidationError as e:
        logger.warning("Failed to update extraction rule", exc_info=True)
        raise BadRequest(detail=str(e))


@region_silo_endpoint
class ProjectMetricsExtractionRulesEndpoint(ProjectEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.EXPERIMENTAL,
        "GET": ApiPublishStatus.EXPERIMENTAL,
        "POST": ApiPublishStatus.EXPERIMENTAL,
        "PUT": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.TELEMETRY_EXPERIENCE
    permission_classes = (ProjectMetricsExtractionRulesPermission,)

    def has_feature(self, organization, request):
        return features.has(
            "organizations:custom-metrics-extraction-rule", organization, actor=request.user
        )

    def _create_audit_entry(self, event: str, project: Project, span_attribute: str):
        self.create_audit_entry(
            request=self.request,
            organization=project.organization,
            target_object=project.id,
            event=audit_log.get_event_id(event),
            data={
                "span_attribute": span_attribute,
                "project_slug": project.slug,
            },
        )

    def delete(self, request: Request, project: Project) -> Response:
        """DELETE an extraction rule in a project. Returns 204 No Data on success."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        config_update = request.data.get("metricsExtractionRules") or []
        if len(config_update) == 0:
            return Response(status=204)

        with handle_exceptions():
            with transaction.atomic(router.db_for_write(SpanAttributeExtractionRuleConfig)):
                delete_extraction_rule_config(project, config_update)
                schedule_invalidate_project_config(
                    project_id=project.id, trigger="span_attribute_extraction_configs"
                )
                for config in config_update:
                    self._create_audit_entry(
                        "SPAN_BASED_METRIC_DELETE", project, config["spanAttribute"]
                    )

            return Response(status=204)

    def get(self, request: Request, project: Project) -> Response:
        """GET extraction rules for project. Returns 200 and a list of extraction rules on success."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        query = request.GET.get("query")

        with handle_exceptions():
            configs = SpanAttributeExtractionRuleConfig.objects.filter(project=project)
            if query:
                configs = configs.filter(span_attribute__icontains=query)

            return self.paginate(
                request,
                queryset=configs,
                paginator_cls=OffsetPaginator,
                on_results=lambda x: serialize(
                    x, user=request.user, serializer=SpanAttributeExtractionRuleConfigSerializer()
                ),
                default_per_page=1000,
                max_per_page=1000,
                max_limit=1000,  # overrides default max_limit of 100 when creating paginator object
            )

    def post(self, request: Request, project: Project) -> Response:
        """POST an extraction rule to create a resource."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        config_update = request.data.get("metricsExtractionRules")

        if not config_update:
            return Response(
                status=400,
                data={"detail": "Please specify the metric extraction rule to be created."},
            )

        with handle_exceptions():
            with transaction.atomic(router.db_for_write(SpanAttributeExtractionRuleConfig)):
                configs = create_extraction_rule_config(request, project, config_update)
                validate_number_of_extracted_metrics(project)
                schedule_invalidate_project_config(
                    project_id=project.id, trigger="span_attribute_extraction_configs"
                )
                for config in configs:
                    self._create_audit_entry(
                        "SPAN_BASED_METRIC_CREATE", project, config.span_attribute
                    )

            persisted_config = serialize(
                configs, request.user, SpanAttributeExtractionRuleConfigSerializer()
            )
            return Response(data=persisted_config, status=200)

    def put(self, request: Request, project: Project) -> Response:
        """PUT to modify an existing extraction rule."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        config_update = request.data.get("metricsExtractionRules")
        if not config_update:
            return Response(status=200)

        with handle_exceptions():
            with transaction.atomic(router.db_for_write(SpanAttributeExtractionRuleConfig)):
                configs = update_extraction_rule_config(request, project, config_update)
                validate_number_of_extracted_metrics(project)
                schedule_invalidate_project_config(
                    project_id=project.id, trigger="span_attribute_extraction_configs"
                )
            for config in configs:
                self._create_audit_entry("SPAN_BASED_METRIC_UPDATE", project, config.span_attribute)

            persisted_config = serialize(
                configs,
                request.user,
                SpanAttributeExtractionRuleConfigSerializer(),
            )

            return Response(data=persisted_config, status=200)


def validate_number_of_extracted_metrics(project: Project):
    all_configs = SpanAttributeExtractionRuleConfig.objects.filter(project=project)

    total_metrics = sum(config.number_of_extracted_metrics for config in all_configs)

    max_specs = options.get("metric_extraction.max_span_attribute_specs")

    if total_metrics > max_specs:
        raise MetricsExtractionRuleValidationError(
            f"Total number of rules exceeds the limit of {max_specs}."
        )
