from __future__ import annotations

import logging
from collections.abc import Mapping

from django.utils import timezone

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.utils.users import SlackUserData, get_slack_data_by_user
from sentry.integrations.utils.identities import get_identities_by_user
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail

logger = logging.getLogger("sentry.integrations.slack.tasks")


@instrumented_task(
    name="sentry.integrations.slack.tasks.link_slack_user_identities",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
    max_retries=3,
)
def link_slack_user_identities(
    integration_id: int,
    organization_id: int,
) -> None:
    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    organization_context = organization_service.get_organization_by_id(id=organization_id)
    organization = organization_context.organization if organization_context else None
    if organization is None or integration is None:
        logger.error(
            "slack.post_install.link_identities.invalid_params",
            extra={
                "organization_id": organization_id,
                "integration_id": integration_id,
                "integration": bool(integration),
                "organization": bool(organization),
            },
        )
        return None

    emails_by_user = UserEmail.objects.get_emails_by_user(organization=organization)
    idp = IdentityProvider.objects.get(
        type=integration.provider,
        external_id=integration.external_id,
    )

    logger.info(
        "slack.post_install.link_identities.start",
        extra={
            "organization": organization.slug,
            "integration_id": integration.id,
        },
    )
    slack_data_by_user = get_slack_data_by_user(integration, organization, emails_by_user)
    for data in slack_data_by_user:
        logger.info(
            "slack.post_install.link_identities.paginate",
            extra={
                "organization": organization.slug,
                "integration_id": integration.id,
                "num_users": len(data),
            },
        )
        update_identities(data, idp)


def update_identities(slack_data_by_user: Mapping[User, SlackUserData], idp: IdentityProvider):
    date_verified = timezone.now()
    identities_by_user = get_identities_by_user(idp, slack_data_by_user.keys())

    for user, data in slack_data_by_user.items():
        slack_id = data.slack_id
        # Identity already exists, the emails match, AND the external ID has changed
        if user in identities_by_user.keys():
            if slack_id != identities_by_user[user].external_id:
                # replace the Identity's external_id with the new one we just got from Slack
                identities_by_user[user].update(external_id=data.slack_id)
            continue
        # the user doesn't already have an Identity and one of their Sentry emails matches their Slack email
        matched_identity, created = Identity.objects.get_or_create(
            idp=idp,
            external_id=slack_id,
            defaults={"user": user, "status": IdentityStatus.VALID, "date_verified": date_verified},
        )
        # the Identity matching that idp/external_id combo is linked to a different user
        if not created:
            logger.info(
                "slack.post_install.identity_linked_different_user",
                extra={
                    "idp_id": idp.id,
                    "external_id": slack_id,
                    "object_id": matched_identity.id,
                    "user_id": user.id,
                    "type": idp.type,
                },
            )
