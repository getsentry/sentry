import uuid

from sentry.models import Organization, User


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
    key = str(uuid.uuid4())  # noqa
    raise NotImplementedError  # TODO


def verify_new_identity(user: User, org: Organization, key: str) -> bool:
    """Verify a key to migrate a user to a new IdP.

    If the provided one-time key is valid, create a new auth identity
    linking the user to the organization's SSO provider.

    :param user: the user profile to link
    :param org: the organization whose SSO provider is being used
    :param key: the one-time verification key
    :return: whether the key is valid
    """
    raise NotImplementedError  # TODO
