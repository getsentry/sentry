from django.contrib.auth.models import AnonymousUser

from sentry import features
from sentry.models.organization import Organization
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser

DYNAMIC_SAMPLING_FEATURE = "organizations:dynamic-sampling"


def has_dynamic_sampling(
    organization: Organization | None, actor: User | RpcUser | AnonymousUser | None = None
) -> bool:
    # If an organization can't be fetched, we will assume it has no dynamic sampling.
    return organization is not None and features.has(
        DYNAMIC_SAMPLING_FEATURE, organization, actor=actor
    )
