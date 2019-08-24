from __future__ import absolute_import

from sentry.incidents.models import IncidentSuspectCommit
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
