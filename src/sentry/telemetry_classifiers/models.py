from __future__ import annotations

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    FlexibleForeignKey,
    cell_silo_model,
    sane_repr,
)
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey


class TelemetryClassifierDataset(models.TextChoices):
    CONVERSATION = "conversation", "Conversation"
    TRACE_SPANS = "trace_spans", "Trace spans"


class TelemetryClassifierOutputType(models.TextChoices):
    # Binary question. Returns the probability of a "yes" response.
    BINARY = "binary", "Binary"

    # Selects a named option. Returns the winner, option probabilities, and confidence.
    CHOICE = "choice", "Multiple choice"

    # Rates input against an ordered rubric. Returns a probability-weighted score.
    SCORE = "score", "Score"


class TelemetryClassifierStatus(models.TextChoices):
    DISABLED = "disabled", "Disabled"
    ENABLED = "enabled", "Enabled"


@cell_silo_model
class TelemetryClassifier(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)

    name = models.CharField(max_length=256)

    # Attribute used to store classifier results.
    result_attribute = models.CharField(max_length=256)

    dataset = models.CharField(max_length=32, choices=TelemetryClassifierDataset.choices)
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
    compiled_prompt = models.TextField(null=True)
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
        ]

    __repr__ = sane_repr("project_id", "name", "status")
