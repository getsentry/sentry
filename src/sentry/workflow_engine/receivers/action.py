from typing import Any

from django.db.models.signals import pre_save
from django.dispatch import receiver
from jsonschema import ValidationError, validate

from sentry.workflow_engine.models.action import Action


@receiver(pre_save, sender=Action)
def enforce_action_config_schema(sender: type[Action], instance: Action, **kwargs: Any) -> None:
    handler = instance.get_handler()

    config_schema = handler.config_schema
    data_schema = handler.data_schema

    if config_schema is not None:
        instance.validate_config(config_schema)

    if data_schema is not None:
        try:
            validate(instance.data, data_schema)
        except ValidationError as e:
            raise ValidationError(f"Invalid config: {e.message}")
