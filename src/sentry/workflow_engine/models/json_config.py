from abc import abstractproperty
from typing import Any

from django.db import models
from jsonschema import ValidationError, validate


class JSONConfigBase(models.Model):
    config = models.JSONField(default=dict, blank=True, null=True)

    @abstractproperty
    def CONFIG_SCHEMA(self) -> dict[str, Any]:
        pass

    def validate_config(self) -> bool:
        try:
            validate(self.config, self.CONFIG_SCHEMA)
        except ValidationError as e:
            raise ValidationError(f"Invalid config: {e.message}")

    class Meta:
        abstract = True
