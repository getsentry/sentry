from __future__ import annotations

from django.contrib.auth.models import AnonymousUser

from sentry import features, quotas
from sentry.constants import DataCategory
from sentry.models.organization import Organization
from sentry.users.models.user import User


def has_size_quota(organization: Organization, actor: User | AnonymousUser | None = None) -> bool:
    if not features.has("organizations:preprod-enforce-quota", organization, actor=actor):
        return True
    return quotas.backend.has_usage_quota(organization.id, DataCategory.SIZE_ANALYSIS)


def has_installable_quota(
    organization: Organization, actor: User | AnonymousUser | None = None
) -> bool:
    if not features.has("organizations:preprod-enforce-quota", organization, actor=actor):
        return True
    return quotas.backend.has_usage_quota(organization.id, DataCategory.INSTALLABLE_BUILD)
