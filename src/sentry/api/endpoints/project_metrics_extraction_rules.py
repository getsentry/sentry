import logging

import sentry_sdk
from django.db import router, transaction
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import ProjectEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.metrics_extraction_rules import (
    SpanAttributeExtractionRuleConfigSerializer,
)
from sentry.models.project import Project
from sentry.sentry_metrics.configuration import HARD_CODED_UNITS
from sentry.sentry_metrics.models import (
    SpanAttributeExtractionRuleCondition,
    SpanAttributeExtractionRuleConfig,
)
from sentry.tasks.relay import schedule_invalidate_project_config

logger = logging.getLogger("sentry.metric_extraction_rules")


class MetricsExtractionRuleValidationError(ValueError):
    pass


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

        config_update = request.data.get("metricsExtractionRules") or []
        if len(config_update) == 0:
            return Response(status=204)

        try:
            with transaction.atomic(router.db_for_write(SpanAttributeExtractionRuleConfig)):
                for obj in config_update:
                    SpanAttributeExtractionRuleConfig.objects.filter(
                        project=project, span_attribute=obj["spanAttribute"]
                    ).delete()
                schedule_invalidate_project_config(
                    project_id=project.id, trigger="span_attribute_extraction_configs"
                )
        except Exception as e:
            sentry_sdk.capture_exception()
            return Response(status=400, data={"detail": str(e)})

        return Response(status=204)

    def get(self, request: Request, project: Project) -> Response:
        """GET extraction rules for project. Returns 200 and a list of extraction rules on success."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        configs = SpanAttributeExtractionRuleConfig.objects.filter(project=project)

        # TODO(metrics): do real pagination using the database
        return self.paginate(
            request,
            queryset=list(configs),
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
        try:
            configs = []
            with transaction.atomic(router.db_for_write(SpanAttributeExtractionRuleConfig)):
                for obj in config_update:
                    configs.append(
                        SpanAttributeExtractionRuleConfig.from_dict(obj, request.user.id, project)
                    )

                validate_number_of_extracted_metrics(project)

                schedule_invalidate_project_config(
                    project_id=project.id, trigger="span_attribute_extraction_configs"
                )

            persisted_config = serialize(
                configs,
                request.user,
                SpanAttributeExtractionRuleConfigSerializer(),
            )
            return Response(data=persisted_config, status=200)

        except MetricsExtractionRuleValidationError as e:
            logger.warning("Failed to update extraction rule", exc_info=True)
            return Response(status=400, data={"detail": str(e)})

        except Exception:
            logger.exception("Failed to update extraction rule")
            return Response(status=400)

    def put(self, request: Request, project: Project) -> Response:
        """PUT to modify an existing extraction rule."""
        if not self.has_feature(project.organization, request):
            return Response(status=404)

        config_update = request.data.get("metricsExtractionRules")
        if not config_update:
            return Response(status=200)

        try:
            with transaction.atomic(router.db_for_write(SpanAttributeExtractionRuleConfig)):
                configs = []
                for obj in config_update:
                    config = SpanAttributeExtractionRuleConfig.objects.get(
                        project=project, span_attribute=obj["spanAttribute"]
                    )
                    config.aggregates = obj["aggregates"]
                    config.unit = HARD_CODED_UNITS.get(obj["spanAttribute"], obj["unit"])
                    config.tags = obj["tags"]
                    config.save()
                    config.refresh_from_db()
                    configs.append(config)

                    # delete conditions not present in update
                    included_conditions = [x["id"] for x in obj["conditions"]]
                    SpanAttributeExtractionRuleCondition.objects.filter(config=config).exclude(
                        id__in=included_conditions
                    ).delete()

                    for condition in obj["conditions"]:
                        condition_id = condition["id"] if "id" in condition else None
                        SpanAttributeExtractionRuleCondition.objects.update_or_create(
                            id=condition_id,
                            config=config,
                            defaults={
                                "value": condition["value"],
                                "created_by_id": request.user.id,
                            },
                        )

                validate_number_of_extracted_metrics(project)

                schedule_invalidate_project_config(
                    project_id=project.id, trigger="span_attribute_extraction_configs"
                )

            persisted_config = serialize(
                configs,
                request.user,
                SpanAttributeExtractionRuleConfigSerializer(),
            )

            return Response(data=persisted_config, status=200)

        except MetricsExtractionRuleValidationError as e:
            logger.warning("Failed to update extraction rule", exc_info=True)
            return Response(status=400, data={"detail": str(e)})

        except Exception:
            logger.exception("Failed to update extraction rule")
            return Response(status=400, data={"detail": "Failed to update extraction rule."})


def validate_number_of_extracted_metrics(project: Project):
    all_configs = SpanAttributeExtractionRuleConfig.objects.filter(project=project)

    total_metrics = sum(config.number_of_extracted_metrics for config in all_configs)

    max_specs = options.get("metric_extraction.max_span_attribute_specs")

    if total_metrics > max_specs:
        raise MetricsExtractionRuleValidationError(
            f"Total number of rules exceeds the limit of {max_specs}."
        )
