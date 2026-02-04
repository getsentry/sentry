from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.workflow_engine.models.data_condition import (
    DataCondition,
    enforce_data_condition_json_schema,
)


@receiver(pre_save, sender=DataCondition)
def enforce_comparison_schema(sender, instance: DataCondition, **kwargs):
    enforce_data_condition_json_schema(instance)
