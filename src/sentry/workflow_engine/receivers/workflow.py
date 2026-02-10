from typing import Any

from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.workflow_engine.models.workflow import Workflow


@receiver(pre_save, sender=Workflow)
def enforce_workflow_config_schema(
    sender: type[Workflow], instance: Workflow, **kwargs: Any
) -> None:
    instance.validate_config(instance.config_schema)
