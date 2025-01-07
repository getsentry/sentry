from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


def has_tempest_access(
    organization: Organization | None, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    return features.has("organizations:tempest-access", organization, actor=actor)
