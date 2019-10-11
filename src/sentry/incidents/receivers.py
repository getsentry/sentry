from __future__ import absolute_import

from django.db.models.signals import post_save
from django.dispatch import receiver

from sentry.incidents.models import AlertRule, IncidentSuspectCommit
from sentry.models.project import Project
from sentry.signals import release_commits_updated


@release_commits_updated.connect(weak=False)
def handle_release_commits_updated(removed_commit_ids, added_commit_ids, **kwargs):
    from sentry.incidents.tasks import calculate_incident_suspects

    incident_ids = (
        IncidentSuspectCommit.objects.filter(commit_id__in=removed_commit_ids | added_commit_ids)
        .values_list("incident_id", flat=True)
        .distinct()
    )
    for incident_id in incident_ids:
        calculate_incident_suspects.apply_async(kwargs={"incident_id": incident_id})


@receiver(post_save, sender=Project, weak=False)
def add_project_to_include_all_rules(instance, created, **kwargs):
    from sentry.incidents.logic import subscribe_projects_to_alert_rule

    if not created:
        return

    alert_rules = AlertRule.objects.filter(
        organization=instance.organization, include_all_projects=True
    )
    for alert_rule in alert_rules:
        subscribe_projects_to_alert_rule(alert_rule, [instance])
