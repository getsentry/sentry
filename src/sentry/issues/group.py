from typing import int
from sentry.issues.ingest import hash_fingerprint
from sentry.models.group import Group


def get_group_by_occurrence_fingerprint(project_id: int, fingerprint: str) -> Group:
    return Group.objects.get(
        grouphash__project_id=project_id, grouphash__hash=hash_fingerprint([fingerprint])[0]
    )
