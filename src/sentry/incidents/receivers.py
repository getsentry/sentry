from datetime import datetime, timezone

from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from sentry.incidents.temp_model import AlertRule, IncidentTrigger
from sentry.models.project import Project


@receiver(post_save, sender=Project, weak=False)
def add_project_to_include_all_rules(instance, created, **kwargs):
    """
    If an alert rule is created for an org that should include all projects
    When a Project model is saved, it will be subscribed to the AlertRule

    NOTE: This feature is not currently utilized and may break the UX flow
    """
    if not created:
        return

    alert_rules = AlertRule.objects.filter(
        organization=instance.organization, include_all_projects=True
    )
    for alert_rule in alert_rules:
        # NOTE: defaults to only subscribe if AlertRule.monitor_type === 'CONTINUOUS'
        alert_rule.subscribe_projects(projects=[instance])


@receiver(pre_save, sender=IncidentTrigger)
def pre_save_incident_trigger(instance, sender, *args, **kwargs):
    instance.date_modified = datetime.now(timezone.utc)
