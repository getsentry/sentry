import logging
from typing import Any

from django.db import models
from jsonschema import ValidationError, validate

logger = logging.getLogger("sentry.workflow_engine.json_config")


class JSONConfigBase(models.Model):
    config = models.JSONField(db_default={})

    def validate_config(self, schema: dict[str, Any]) -> None:
        try:
            validate(self.config, schema)
        except ValidationError as e:
            raise ValidationError(f"Invalid config: {e.message}")

    class Meta:
        abstract = True
