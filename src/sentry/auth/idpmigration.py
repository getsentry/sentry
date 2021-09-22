import string
from datetime import timedelta

from django.utils.crypto import get_random_string

from sentry import options
from sentry.models import Organization, OrganizationMember, User
from sentry.utils import redis
from sentry.utils.email import MessageBuilder

_REDIS_KEY = "verificationKeyStorage"
_TTL = timedelta(minutes=10)


def send_confirm_email(user: User, email: str, verification_key: str) -> None:
    context = {
        "user": user,
        # TODO left incase we want to have a clickable verification link for future
        # "url": absolute_uri(
        #     reverse("sentry-account-confirm-email", args=[user.id, verification_key])
        # ),
        "confirm_email": email,
        "verification_key": verification_key,
    }
    msg = MessageBuilder(
        subject="{}Confirm Email".format(options.get("mail.subject-prefix")),
        template="sentry/emails/idp_verification_email.txt",
        html_template="sentry/emails/idp_verification_email.html",
        type="user.confirm_email",
        context=context,
    )
    msg.send_async([email])


def create_verification_key(user: User, org: Organization, email: str) -> None:
    """Store and email a verification key for IdP migration.

    Create a one-time verification key for a user whose SSO identity
    has been deleted, presumably because the parent organization has
    switched identity providers. Store the key in Redis and send it
    in an email to the associated address.

    :param user: the user profile to link
    :param org: the organization whose SSO provider is being used
    :param email: the email address associated with the SSO identity
    """
    cluster = redis.clusters.get("default").get_local_client_for_key(_REDIS_KEY)
    member_id = OrganizationMember.objects.get(organization=org, user=user).id

    verification_code = get_random_string(32, string.ascii_letters + string.digits)
    verification_key = f"auth:one-time-key:{verification_code}"
    verification_value = {"user_id": user.id, "email": email, "member_id": member_id}
    cluster.hmset(verification_key, verification_value)
    cluster.expire(verification_key, int(_TTL.total_seconds()))

    send_confirm_email(user, email, verification_code)


def verify_new_identity(key: str) -> str:
    """Verify a key to migrate a user to a new IdP.

    If the provided one-time key is valid, create a new auth identity
    linking the user to the organization's SSO provider.

    :param user: the user profile to link
    :param org: the organization whose SSO provider is being used
    :param key: the one-time verification key
    :return: whether the key is valid
    """
    cluster = redis.clusters.get("default").get_local_client_for_key(_REDIS_KEY)

    verification_key = f"auth:one-time-key:{key}"
    verification_value_byte = cluster.hgetall(verification_key)

    if not verification_value_byte:
        return ""

    return verification_key
