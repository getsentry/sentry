from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from sentry import features

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.organizations.services.organization.model import RpcOrganization

_FLAG = "organizations:seer-code-review-gitlab"


def debug_log(
    logger: logging.Logger,
    organization: Organization | RpcOrganization | int,
    message: str,
    *,
    level: int = logging.INFO,
    exc_info: bool = False,
    **extra: object,
) -> None:
    from sentry.models.organization import Organization as Org

    if isinstance(organization, int):
        try:
            organization = Org.objects.get_from_cache(id=organization)
        except Org.DoesNotExist:
            return

    if not features.has(_FLAG, organization):
        return

    logger.log(level, message, extra=extra, exc_info=exc_info)
