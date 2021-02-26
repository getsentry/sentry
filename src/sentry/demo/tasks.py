from sentry.models import Organization, OrganizationStatus, User
from sentry.tasks.base import instrumented_task
from sentry.tasks.deletion import delete_organization, retry
from sentry.exceptions import DeleteAborted

MAX_RETRIES = 5


@instrumented_task(
    name="sentry.demo.tasks.delete_organization_and_user",
    queue="cleanup",
    default_retry_delay=60 * 5,
    max_retries=MAX_RETRIES,
)
@retry(exclude=(DeleteAborted,))
def delete_organization_and_user(organization_id, user_id):
    Organization.objects.filter(id=organization_id).update(
        status=OrganizationStatus.PENDING_DELETION
    )
    User.objects.filter(id=user_id).delete()

    delete_organization(
        object_id=organization_id,
        actor_id=user_id,
    )
