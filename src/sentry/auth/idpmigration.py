import string
from datetime import timedelta

from django.urls import reverse
from django.utils.crypto import get_random_string

from sentry import options
from sentry.models import Organization, OrganizationMember, User
from sentry.utils import json, redis
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

REDIS_KEY = "verificationKeyStorage"
_TTL = timedelta(minutes=10)


def send_confirm_email(user: User, email: str, verification_key: str) -> None:
    context = {
        "user": user,
        "url": absolute_uri(
            reverse(
                "sentry-idp-email-verification",
                args=[verification_key],
            )
        ),
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


def get_redis_cluster():
    return redis.clusters.get("default").get_local_client_for_key(REDIS_KEY)


def send_one_time_account_confirm_link(
    user: User, org: Organization, email: str, identity_id: str
) -> str:
    """Store and email a verification key for IdP migration.

    Create a one-time verification key for a user whose SSO identity
    has been deleted, presumably because the parent organization has
    switched identity providers. Store the key in Redis and send it
    in an email to the associated address.

    :param user: the user profile to link
    :param org: the organization whose SSO provider is being used
    :param email: the email address associated with the SSO identity
    :param identity_id: the SSO identity id
    """
    cluster = get_redis_cluster()
    member_id = OrganizationMember.objects.get(organization=org, user=user).id

    verification_code = get_random_string(32, string.ascii_letters + string.digits)
    verification_key = f"auth:one-time-key:{verification_code}"
    verification_value = {
        "user_id": user.id,
        "email": email,
        "member_id": member_id,
        "identity_id": identity_id,
    }
    cluster.setex(verification_key, int(_TTL.total_seconds()), json.dumps(verification_value))

    send_confirm_email(user, email, verification_code)

    return verification_code


def get_redis_key(verification_key: str) -> str:
    return f"auth:one-time-key:{verification_key}"


def get_verification_value_from_key(verification_key):
    cluster = get_redis_cluster()
    verification_value = cluster.get(verification_key)
    if verification_value:
        return json.loads(verification_value)
    return verification_value


def verify_account(key: str) -> bool:
    """Verify a key to migrate a user to a new IdP.

    If the provided one-time key is valid, create a new auth identity
    linking the user to the organization's SSO provider.

    :param user: the user profile to link
    :param org: the organization whose SSO provider is being used
    :param key: the one-time verification key
    :return: whether the key is valid
    """
    verification_key = get_redis_key(key)
    verification_value = get_verification_value_from_key(verification_key)
    if not verification_value:
        return False

    return True
