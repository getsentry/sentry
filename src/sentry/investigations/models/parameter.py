from __future__ import annotations

from typing import Any

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, cell_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField


class InvestigationParameterType(models.TextChoices):
    STRING = "string", "String"
    NUMBER = "number", "Number"
    BOOLEAN = "boolean", "Boolean"
    ENUM = "enum", "Enum"
    DURATION = "duration", "Duration"
    DATETIME_RANGE = "datetime_range", "Datetime range"
    PROJECT = "project", "Project"
    PROJECT_LIST = "project_list", "Project list"
    ENVIRONMENT_LIST = "environment_list", "Environment list"


class InvestigationParameterSource(models.TextChoices):
    TEMPLATE = "template", "Template"
    USER = "user", "User"
    AGENT = "agent", "Agent"


@cell_silo_model
class InvestigationParameter(DefaultFieldsModel):
    """A typed, notebook-level input declared by a template or explicitly promoted."""

    __relocation_scope__ = RelocationScope.Excluded

    investigation = FlexibleForeignKey(
        "investigations.Investigation", on_delete=models.CASCADE, related_name="parameters"
    )
    key = models.CharField(max_length=128)
    label = models.CharField(max_length=255)
    description = models.TextField(default="", blank=True, db_default="")
    type = models.CharField(max_length=32, choices=InvestigationParameterType.choices)
    required = models.BooleanField(default=False, db_default=False)

    # Type-specific validation such as enum options or numeric/time bounds.
    validation_constraints: models.Field[dict[str, Any], dict[str, Any]] = models.JSONField(
        default=dict, db_default={}
    )
    default_value = models.JSONField(null=True)
    saved_value = models.JSONField(null=True)
    source = models.CharField(
        max_length=32,
        choices=InvestigationParameterSource.choices,
        default=InvestigationParameterSource.TEMPLATE,
        db_default=InvestigationParameterSource.TEMPLATE,
    )
    position = BoundedPositiveIntegerField()
    version = BoundedPositiveIntegerField(default=1, db_default=1)

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationparameter"
        constraints = [
            models.UniqueConstraint(
                fields=["investigation", "key"], name="investigation_unique_parameter_key"
            )
        ]
        indexes = [models.Index(fields=["investigation", "position"])]

    __repr__ = sane_repr("investigation_id", "key", "type")


@cell_silo_model
class InvestigationBlockParameter(DefaultFieldsModel):
    """Declares that a block consumes a notebook-level parameter."""

    __relocation_scope__ = RelocationScope.Excluded

    block = FlexibleForeignKey(
        "investigations.InvestigationBlock",
        on_delete=models.CASCADE,
        related_name="parameter_links",
    )
    parameter = FlexibleForeignKey(
        "investigations.InvestigationParameter",
        on_delete=models.CASCADE,
        related_name="block_links",
    )

    class Meta:
        app_label = "investigations"
        db_table = "investigations_investigationblockparameter"
        constraints = [
            models.UniqueConstraint(
                fields=["block", "parameter"], name="investigation_unique_block_parameter"
            )
        ]
