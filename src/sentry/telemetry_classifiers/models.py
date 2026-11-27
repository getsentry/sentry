from __future__ import annotations

from typing import Any

import pydantic
from django.core.exceptions import ValidationError
from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.telemetry_classifiers.compiled_prompt import SeerDecisionPrompt
from sentry.telemetry_classifiers.types import (
    Dataset,
    TelemetryClassifierOutputType,
    TelemetryClassifierStatus,
)


@cell_silo_model
class TelemetryClassifier(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    name = models.CharField(max_length=256)

    # Attribute used to store classifier results, without RESULT_ATTRIBUTE_PREFIX.
    result_attribute = models.CharField(max_length=256)

    dataset = models.CharField(max_length=32, choices=Dataset.choices)
    filter_query = models.TextField()
    status = models.CharField(
        max_length=16,
        choices=TelemetryClassifierStatus.choices,
        default=TelemetryClassifierStatus.ENABLED,
    )

    # Prebuilt classifiers resolve this key through PREBUILT_CLASSIFIERS.
    prebuilt_classifier_key = models.CharField(max_length=256, null=True)

    # Custom classifier fields.
    natural_language_prompt = models.TextField(null=True)
    compiled_prompt = models.JSONField(null=True)
    output_type = models.CharField(
        max_length=16,
        choices=TelemetryClassifierOutputType.choices,
        null=True,
    )

    created_by_id = HybridCloudForeignKey("sentry.User", null=True, on_delete="SET_NULL")

    class Meta:
        app_label = "telemetry_classifiers"
        db_table = "telemetry_classifiers_telemetryclassifier"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(
                        prebuilt_classifier_key__isnull=False,
                        natural_language_prompt__isnull=True,
                        compiled_prompt__isnull=True,
                        output_type__isnull=True,
                    )
                    | models.Q(
                        prebuilt_classifier_key__isnull=True,
                        natural_language_prompt__isnull=False,
                        output_type__isnull=False,
                    )
                ),
                name="telemetry_classifier_definition_shape",
            ),
            models.CheckConstraint(
                condition=~models.Q(
                    status=TelemetryClassifierStatus.ENABLED,
                    prebuilt_classifier_key__isnull=True,
                    compiled_prompt__isnull=True,
                ),
                name="telemetry_classifier_enabled_definition_ready",
            ),
            models.UniqueConstraint(
                fields=["project", "result_attribute"],
                name="telemetry_classifier_unique_result_attribute",
            ),
        ]

    __repr__ = sane_repr("project_id", "name", "status")

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.compiled_prompt is not None:
            try:
                SeerDecisionPrompt.parse_obj(self.compiled_prompt)
            except pydantic.ValidationError as error:
                raise ValidationError({"compiled_prompt": str(error)})
        super().save(*args, **kwargs)
