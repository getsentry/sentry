from __future__ import absolute_import

from django.db.models import F

from sentry import analytics
from sentry.models import Project
from sentry.signals import event_processed


@event_processed.connect(weak=False)
def record_first_transaction(project, event, **kwargs):
    if event.get_event_type() == "transaction" and not project.flags.has_transactions:
        project.update(flags=F("flags").bitor(Project.flags.has_transactions))

        try:
            default_user_id = project.organization.get_default_owner().id
        except IndexError:
            default_user_id = None

        analytics.record(
            "first_transaction.sent",
            default_user_id=default_user_id,
            project_id=project.id,
            organization_id=project.organization_id,
            platform=project.platform,
        )
