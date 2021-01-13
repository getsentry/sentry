from uuid import uuid4
from sentry.models import Project, ProjectStatus
from sentry.db.mixin import delete_pending_deletion_option
from sentry.tasks.deletion import delete_project

stalled_projects = Project.objects.filter(status__in=[ProjectStatus.PENDING_DELETION,ProjectStatus.DELETION_IN_PROGRESS])

for stalled_project in stalled_projects:
    delete_pending_deletion_option(stalled_project)
    stalled_project.rename_on_pending_deletion() 

    transaction_id = uuid4().hex
    delete_project.apply_async(
        kwargs={"object_id": stalled_project.id, "transaction_id": transaction_id}, countdown=3600
    )