from __future__ import print_function, absolute_import

from sentry import analytics
from sentry.signals import group_created


@group_created.connect(weak=False)
def record_join_request_created(group, project, organization, **kwargs):
    analytics.record(
        "issue.created", group_id=group.id, project_id=project.id, organization_id=organization.id
    )
