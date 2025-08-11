from datetime import datetime, timezone

from django.db.models.signals import pre_save
from django.dispatch import receiver

from sentry.incidents.models.incident import IncidentTrigger


@receiver(pre_save, sender=IncidentTrigger)
def pre_save_incident_trigger(instance, sender, *args, **kwargs):
    instance.date_modified = datetime.now(timezone.utc)
