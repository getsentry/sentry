from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.workflow_engine.models.detector import Detector, enforce_config_schema


@receiver(pre_save, sender=Detector)
def enforce_config_schema_signal(sender, instance: Detector, **kwargs):
    """
    This needs to be a signal because the grouptype registry's entries are not available at import time.
    """
    enforce_config_schema(instance)
