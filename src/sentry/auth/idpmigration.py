from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict

from django.urls import reverse
from rb.clients import LocalClient

from sentry import options
from sentry.models.authprovider import AuthProvider
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization import RpcOrganization, organization_service
from sentry.utils import json, metrics, redis
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.security import get_secure_token

_REDIS_KEY = "verificationKeyStorage"
_TTL = timedelta(minutes=10)
SSO_VERIFICATION_KEY = "confirm_account_verification_key"


def send_one_time_account_confirm_link(
    user: User,
    org: RpcOrganization,
    provider: AuthProvider,
    email: str,
    identity_id: str,
) -> AccountConfirmLink:
    """Store and email a verification key for IdP migration.

    Create a one-time verification key for a user whose SSO identity
    has been deleted, presumably because the parent organization has
    switched identity providers. Store the key in Redis and send it
    in an email to the associated address.

    :param user: the user profile to link
    :param org: the organization whose SSO provider is being used
    :param provider: the SSO provider
    :param email: the email address associated with the SSO identity
    :param identity_id: the SSO identity id
    """
    link = AccountConfirmLink(user, org, provider, email, identity_id)
    link.store_in_redis()
    link.send_confirm_email()
    return link


def get_redis_cluster() -> LocalClient:
    return redis.clusters.get("default").get_local_client_for_key(_REDIS_KEY)


@dataclass
class AccountConfirmLink:
    user: User
    organization: RpcOrganization
    provider: AuthProvider
    email: str
    identity_id: str

    def __post_init__(self) -> None:
        self.verification_code = get_secure_token()
        self.verification_key = f"auth:one-time-key:{self.verification_code}"

    def send_confirm_email(self) -> None:
        context = {
            "user": self.user,
            "organization": self.organization.name,
            "provider": self.provider.provider_name,
            "url": absolute_uri(
                reverse(
                    "sentry-idp-email-verification",
                    args=[self.verification_code],
                )
            ),
            "email": self.email,
            "verification_key": self.verification_code,
        }
        msg = MessageBuilder(
            subject="{}Confirm Account".format(options.get("mail.subject-prefix")),
            template="sentry/emails/idp_verification_email.txt",
            html_template="sentry/emails/idp_verification_email.html",
            type="user.confirm_email",
            context=context,
        )
        msg.send_async([self.email])
        metrics.incr("idpmigration.confirm_link_sent", sample_rate=1.0)

    def store_in_redis(self) -> None:
        cluster = get_redis_cluster()

        member = organization_service.check_membership_by_id(
            organization_id=self.organization.id, user_id=self.user.id
        )

        verification_value = {
            "user_id": self.user.id,
            "email": self.email,
            "member_id": member.id if member is not None else None,
            "organization_id": self.organization.id,
            "identity_id": self.identity_id,
            "provider": self.provider.provider,
        }
        cluster.setex(
            self.verification_key, int(_TTL.total_seconds()), json.dumps(verification_value)
        )


def get_verification_value_from_key(key: str) -> Dict[str, Any] | None:
    cluster = get_redis_cluster()
    verification_key = f"auth:one-time-key:{key}"
    verification_str = cluster.get(verification_key)
    if verification_str is None:
        metrics.incr("idpmigration.confirmation_failure", sample_rate=1.0)
        return None

    verification_value: Dict[str, Any] = json.loads(verification_str)
    metrics.incr(
        "idpmigration.confirmation_success",
        tags={"provider": verification_value.get("provider")},
        sample_rate=1.0,
    )
    return verification_value
