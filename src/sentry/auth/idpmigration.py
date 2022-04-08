from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict

from django.urls import reverse

from sentry import options
from sentry.models import AuthProvider, Organization, OrganizationMember, User
from sentry.utils import json, metrics, redis
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri
from sentry.utils.security import get_secure_token

_REDIS_KEY = "verificationKeyStorage"
_TTL = timedelta(minutes=10)
SSO_VERIFICATION_KEY = "confirm_account_verification_key"


def send_one_time_account_confirm_link(
    user: User,
    org: Organization,
    provider: AuthProvider,
    email: str,
    identity_id: str,
) -> "AccountConfirmLink":
    """Store and email a verification key for IdP migration.

    Create a one-time verification key for a user whose SSO identity
    has been deleted, presumably because the parent organization has
    switched identity providers. Store the key in Redis and send it
    in an email to the associated address.

    :param user: the user profile to link
    :param organization: the organization whose SSO provider is being used
    :param provider: the SSO provider
    :param email: the email address associated with the SSO identity
    :param identity_id: the SSO identity id
    """
    link = AccountConfirmLink(user, org, provider, email, identity_id)
    link.store_in_redis()
    link.send_confirm_email()
    return link


def get_redis_cluster():
    return redis.clusters.get("default").get_local_client_for_key(_REDIS_KEY)


@dataclass
class AccountConfirmLink:
    user: User
    organization: Organization
    provider: AuthProvider
    email: str
    identity_id: str

    def __post_init__(self):
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

        try:
            member_id = OrganizationMember.objects.get(
                organization=self.organization, user=self.user
            ).id
        except OrganizationMember.DoesNotExist:
            member_id = None

        verification_value = {
            "user_id": self.user.id,
            "email": self.email,
            "member_id": member_id,
            "organization_id": self.organization.id,
            "identity_id": self.identity_id,
            "provider": self.provider.provider,
        }
        cluster.setex(
            self.verification_key, int(_TTL.total_seconds()), json.dumps(verification_value)
        )


def get_verification_value_from_key(key: str) -> Dict[str, Any]:
    cluster = get_redis_cluster()
    verification_key = f"auth:one-time-key:{key}"
    verification_value = cluster.get(verification_key)
    if verification_value:
        verification_value = json.loads(verification_value)
        metrics.incr(
            "idpmigration.confirmation_success",
            tags={key: verification_value.get(key) for key in ("provider", "organization_id")},
            sample_rate=1.0,
        )
    else:
        metrics.incr("idpmigration.confirmation_failure", sample_rate=1.0)
    return verification_value
