import logging
from typing import Optional

from django.utils import timezone

from sentry.integrations.slack.utils import get_slack_data_by_user
from sentry.integrations.utils import get_identities_by_user
from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    Integration,
    Organization,
    UserEmail,
)
from sentry.tasks.base import instrumented_task

logger = logging.getLogger("sentry.integrations.slack.tasks")


@instrumented_task(
    name="sentry.integrations.slack.link_users_identities",
    queue="integrations",
)
def link_slack_user_identities(
    integration: Optional[Integration] = None,  # deprecated
    organization: Optional[Organization] = None,  # deprecated
    integration_id: Optional[int] = None,
    organization_id: Optional[int] = None,
) -> None:
    # TODO(hybridcloud) This needs to use the integration service
    # as we are crossing silo boundaries.
    if integration_id is not None:
        integration = Integration.objects.get(id=integration_id)
    if organization_id is not None:
        # TODO(hybridcloud) This needs to use organization_service
        # once member mappings are whole.
        organization = Organization.objects.get(id=organization_id)
    assert organization and integration  # type narrowing

    # TODO(hybridcloud) This task is called from slack.integration.SlackIntegration,.post_install()
    # which should happen in control silo, as it is part of integration install.
    emails_by_user = UserEmail.objects.get_emails_by_user(organization)
    slack_data_by_user = get_slack_data_by_user(integration, organization, emails_by_user)

    idp = IdentityProvider.objects.get(
        type=integration.provider,
        external_id=integration.external_id,
    )
    date_verified = timezone.now()
    identities_by_user = get_identities_by_user(idp, slack_data_by_user.keys())

    for user, data in slack_data_by_user.items():
        # Identity already exists, the emails match, AND the external ID has changed
        if user in identities_by_user.keys():
            if data["slack_id"] != identities_by_user[user].external_id:
                # replace the Identity's external_id with the new one we just got from Slack
                identities_by_user[user].update(external_id=data["slack_id"])
            continue
        # the user doesn't already have an Identity and one of their Sentry emails matches their Slack email
        matched_identity, created = Identity.objects.get_or_create(
            idp=idp,
            external_id=data["slack_id"],
            defaults={"user": user, "status": IdentityStatus.VALID, "date_verified": date_verified},
        )
        # the Identity matching that idp/external_id combo is linked to a different user
        if not created:
            logger.info(
                "post_install.identity_linked_different_user",
                extra={
                    "idp_id": idp.id,
                    "external_id": data["slack_id"],
                    "object_id": matched_identity.id,
                    "user_id": user.id,
                    "type": idp.type,
                },
            )
