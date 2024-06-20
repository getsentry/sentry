from __future__ import annotations

import logging
from collections.abc import Mapping

from django.utils import timezone

from sentry import features
from sentry.integrations.slack.utils import get_slack_data_by_user
from sentry.integrations.slack.utils.users import SlackUserData, get_slack_data_by_user_via_sdk
from sentry.integrations.utils import get_identities_by_user
from sentry.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.integrations.slack.tasks")


@instrumented_task(
    name="sentry.integrations.slack.link_users_identities",
    queue="integrations.control",
    silo_mode=SiloMode.CONTROL,
)
def link_slack_user_identities(
    integration_id: int | None = None,
    organization_id: int | None = None,
) -> None:
    if integration_id is not None:
        integration = integration_service.get_integration(integration_id=integration_id)
    if organization_id is not None:
        organization = organization_service.get_organization_by_id(id=organization_id).organization
    assert organization is not None and integration is not None

    emails_by_user = UserEmail.objects.get_emails_by_user(organization=organization)
    idp = IdentityProvider.objects.get(
        type=integration.provider,
        external_id=integration.external_id,
    )

    if not features.has("organizations:slack-sdk-get-users", organization):
        slack_data_by_user = get_slack_data_by_user(integration, organization, emails_by_user)
        update_identities(slack_data_by_user, idp)
        return None

    logger.info(
        "slack.post_install.link_identities.start",
        extra={
            "organization": organization.slug,
            "integration_id": integration.id,
        },
    )
    slack_data_by_user = get_slack_data_by_user_via_sdk(integration, organization, emails_by_user)
    for data in slack_data_by_user:
        update_identities(data, idp)


# has different typing for slack_data_by_user, need to grab slack_id from a dataclass
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
                "post_install.identity_linked_different_user",
                extra={
                    "idp_id": idp.id,
                    "external_id": slack_id,
                    "object_id": matched_identity.id,
                    "user_id": user.id,
                    "type": idp.type,
                },
            )
