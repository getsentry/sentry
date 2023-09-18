import logging

from sentry import features
from sentry.api.endpoints.organization_missing_org_members import _get_missing_organization_members
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.notifications.notifications.missing_members_nudge import MissingMembersNudgeNotification
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.tasks.invite_missing_org_members.schedule_organizations",
    max_retries=3,
    silo_mode=SiloMode.REGION,
)
def schedule_organizations():
    logger.info("invite_missing_org_members.schedule_organizations")

    github_org_integrations = integration_service.get_organization_integrations(
        providers=["github"], status=ObjectStatus.ACTIVE
    )
    orgs_with_github_integrations = {
        org_integration.organization_id for org_integration in github_org_integrations
    }

    for org_id in orgs_with_github_integrations:
        send_nudge_email.delay(org_id)


@instrumented_task(
    name="sentry.tasks.invite_missing_members.send_nudge_email",
    silo_mode=SiloMode.REGION,
    queue="nudge.invite_missing_org_members",
)
def send_nudge_email(org_id):
    logger.info("invite_missing_org_members.send_nudge_email")

    try:
        organization = Organization.objects.get_from_cache(id=org_id)
    except Organization.DoesNotExist:
        logger.info(
            "invite_missing_org_members.send_nudge_email.missing_org",
            extra={"organization_id": org_id},
        )
        return

    if not features.has("organizations:integrations-gh-invite", organization):
        logger.info(
            "invite_missing_org_members.send_nudge_email.missing_flag",
            extra={"organization_id": org_id},
        )
        return

    integrations = integration_service.get_integrations(
        organization_id=org_id, providers=["github"], status=ObjectStatus.ACTIVE
    )

    if not integrations:
        logger.info(
            "invite_missing_org_members.send_nudge_email.missing_integrations",
            extra={"organization_id": org_id},
        )
        return

    commit_author_query = _get_missing_organization_members(
        organization, provider="github", integration_ids=[i.id for i in integrations]
    )

    if not commit_author_query.exists():  # don't email if no missing commit authors
        logger.info(
            "invite_missing_org_members.send_nudge_email.no_commit_authors",
            extra={"organization_id": org_id},
        )
        return

    commit_authors = []
    for commit_author in commit_author_query:
        commit_authors.append(
            {
                "email": commit_author.email,
                "external_id": commit_author.external_id,
                "commit_count": commit_author.commit__count,
            }
        )

    notification = MissingMembersNudgeNotification(
        organization=organization, commit_authors=commit_authors
    )

    logger.info(
        "invite_missing_org_members.send_nudge_email.send_notification",
        extra={"organization_id": org_id},
    )

    notification.send()
