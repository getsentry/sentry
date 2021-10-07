import string
from dataclasses import dataclass
from datetime import timedelta

from django.urls import reverse
from django.utils.crypto import get_random_string

from sentry import options
from sentry.models import Organization, OrganizationMember, User
from sentry.utils import redis
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

_REDIS_KEY = "verificationKeyStorage"
_TTL = timedelta(minutes=10)
SSO_VERIFICATION_KEY = "confirm_account_verification_key"


def send_one_time_account_confirm_link(
    user: User,
    org: Organization,
    provider_name: str,
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
    :param provider_name: a display name for the SSO provider
    :param email: the email address associated with the SSO identity
    :param identity_id: the SSO identity id
    """
    link = AccountConfirmLink(user, org, provider_name, email, identity_id)
    link.store_in_redis()
    link.send_confirm_email()
    return link


@dataclass
class AccountConfirmLink:
    user: User
    organization: Organization
    provider_name: str
    email: str
    identity_id: str

    def __post_init__(self):
        self.verification_code = get_random_string(32, string.ascii_letters + string.digits)
        self.verification_key = get_redis_key(self.verification_code)

    def send_confirm_email(self) -> None:
        context = {
            "user": self.user,
            "organization": self.organization.name,
            "provider": self.provider_name,
            "url": absolute_uri(
                reverse(
                    "sentry-idp-email-verification",
                    args=[self.verification_key],
                )
            ),
            "email": self.email,
            "verification_key": self.verification_key,
        }
        msg = MessageBuilder(
            subject="{}Confirm Account".format(options.get("mail.subject-prefix")),
            template="sentry/emails/idp_verification_email.txt",
            html_template="sentry/emails/idp_verification_email.html",
            type="user.confirm_email",
            context=context,
        )
        msg.send_async([self.email])

    def store_in_redis(self) -> None:
        cluster = redis.clusters.get("default").get_local_client_for_key(_REDIS_KEY)
        member_id = OrganizationMember.objects.get(
            organization=self.organization, user=self.user
        ).id

        verification_value = {
            "user_id": self.user.id,
            "email": self.email,
            "member_id": member_id,
            "identity_id": self.identity_id,
        }
        cluster.hmset(self.verification_key, verification_value)
        cluster.expire(self.verification_key, int(_TTL.total_seconds()))


def get_redis_key(verification_key: str) -> str:
    return f"auth:one-time-key:{verification_key}"


def verify_account(key: str) -> bool:
    """Verify a key to migrate a user to a new IdP.

    If the provided one-time key is valid, create a new auth identity
    linking the user to the organization's SSO provider.

    :param user: the user profile to link
    :param org: the organization whose SSO provider is being used
    :param key: the one-time verification key
    :return: whether the key is valid
    """
    cluster = redis.clusters.get("default").get_local_client_for_key(_REDIS_KEY)

    verification_key = get_redis_key(key)
    verification_value_byte = cluster.hgetall(verification_key)
    if not verification_value_byte:
        return False

    return True
