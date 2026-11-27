from __future__ import annotations

import logging
from collections.abc import Mapping

from cryptography.fernet import InvalidToken
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration import integration_service
from sentry.integrations.slack.utils.users import SlackUserData, get_slack_data_by_user
from sentry.integrations.utils.identities import get_identities_by_user
from sentry.organizations.services.organization import organization_service
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_control_tasks
from sentry.users.models.identity import Identity, IdentityProvider, IdentityStatus
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.utils.security.encrypted_field_key_store import FernetKeyStore

logger = logging.getLogger("sentry.integrations.slack.tasks")

USER_TOKEN_TTL = 60 * 60


def encrypt_user_token(user_token: str) -> tuple[str, str] | None:
    """
    Encrypt the installer's Slack user token so it stays out of task arguments and error
    reports. Returns (key_id, encrypted_token), or None when no encryption key is configured,
    as in most self-hosted installs.
    """
    try:
        key_id, fernet = FernetKeyStore.get_primary_fernet()
    except ValueError:
        return None
    return key_id, fernet.encrypt(user_token.encode()).decode()


def _decrypt_user_token(key_id: str, encrypted_user_token: str) -> str | None:
    try:
        return (
            FernetKeyStore.get_fernet_for_key_id(key_id)
            .decrypt(encrypted_user_token.encode(), ttl=USER_TOKEN_TTL)
            .decode()
        )
    except (InvalidToken, ValueError):
        logger.warning("slack.post_install.link_identities.user_token_unavailable")
        return None


@instrumented_task(
    name="sentry.integrations.slack.tasks.link_slack_user_identities",
    namespace=integrations_control_tasks,
    retry=Retry(times=3),
    silo_mode=SiloMode.CONTROL,
)
def link_slack_user_identities(
    integration_id: int,
    organization_id: int,
    key_id: str | None = None,
    encrypted_user_token: str | None = None,
) -> None:
    integration = integration_service.get_integration(
        integration_id=integration_id, status=ObjectStatus.ACTIVE
    )
    organization_context = organization_service.get_organization_by_id(id=organization_id)
    organization = organization_context.organization if organization_context else None
    if organization is None or integration is None:
        logger.warning(
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
    # Slack only returns member emails to a token with users:read.email. The installer's
    # user token has it; the bot token may not, and without emails nothing matches.
    user_token = (
        _decrypt_user_token(key_id, encrypted_user_token)
        if key_id and encrypted_user_token
        else None
    )
    slack_data_by_user = get_slack_data_by_user(
        integration, organization, emails_by_user, access_token=user_token
    )
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


def update_identities(
    slack_data_by_user: Mapping[User, SlackUserData], idp: IdentityProvider
) -> None:
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
