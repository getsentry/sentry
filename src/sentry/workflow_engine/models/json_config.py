from abc import abstractproperty
from typing import Any

from django.db import models
from jsonschema import ValidationError, validate


class JSONConfigBase(models.Model):
    config = models.JSONField(db_default={})

    @abstractproperty
    def CONFIG_SCHEMA(self) -> dict[str, Any]:
        pass

    def validate_config(self) -> None:
        try:
            validate(self.config, self.CONFIG_SCHEMA)
        except ValidationError as e:
            raise ValidationError(f"Invalid config: {e.message}")

    class Meta:
        abstract = True
