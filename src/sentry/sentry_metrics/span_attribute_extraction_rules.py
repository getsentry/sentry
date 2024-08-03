from typing import Any

import sentry_sdk
from rest_framework.request import Request

from sentry.models.project import Project
from sentry.sentry_metrics.configuration import HARD_CODED_UNITS
from sentry.sentry_metrics.models import (
    SpanAttributeExtractionRuleCondition,
    SpanAttributeExtractionRuleConfig,
)


def create_extraction_rule_config(request: Request, project: Project, config_update: Any):
    configs = []
    for obj in config_update:
        configs.append(SpanAttributeExtractionRuleConfig.from_dict(obj, request.user.id, project))
        if (
            "conditions" not in obj
            or len(obj["conditions"]) == 0
            or (len(obj["conditions"]) == 1 and obj["conditions"][0] == "")
        ):
            with sentry_sdk.new_scope() as scope:
                scope.set_tag("project", project.slug)
                sentry_sdk.capture_message(
                    "A MetricExtractionRuleConfig without conditions was created.",
                )

    return configs


def delete_extraction_rule_config(project: Project, config_update: Any):
    for obj in config_update:
        SpanAttributeExtractionRuleConfig.objects.filter(
            project=project, span_attribute=obj["spanAttribute"]
        ).delete()


def update_extraction_rule_config(request: Request, project: Project, config_update: Any):
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
        included_conditions = [x["id"] for x in obj["conditions"] if "id" in x]
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
    return configs
