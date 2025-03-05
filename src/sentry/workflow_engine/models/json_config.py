from typing import Any

from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
from jsonschema import ValidationError, validate


class JSONConfigBase(models.Model):
    config = models.JSONField(db_default={})

    def validate_config(self, schema: dict[str, Any]) -> None:
        try:
            validate(self.config, schema)
        except ValidationError as e:
            raise ValidationError(f"Invalid config: {e.message}")

    class Meta:
        abstract = True


@receiver(pre_save, sender=JSONConfigBase)
def enforce_config_schema(sender, instance: JSONConfigBase, **kwargs):
    """
    Add a default receiver that
    """
    schema = kwargs.get("schema", None) or instance.config_schema

    if schema is not None:
        instance.validate_config(schema)
