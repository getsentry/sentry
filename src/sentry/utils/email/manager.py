from __future__ import annotations

import logging
from typing import Iterable, Mapping

from sentry.models import Project, UserEmail

from ...services.hybrid_cloud.user import user_service
from ...services.hybrid_cloud.user_option import user_option_service
from .faker import is_fake_email

logger = logging.getLogger("sentry.mail")


def get_email_addresses(
    user_ids: Iterable[int], project: Project | None = None
) -> Mapping[int, str]:
    """
    Find the best email addresses for a collection of users. If a project is
    provided, prefer their project-specific notification preferences.
    """
    pending = set(user_ids)
    results = {}

    if project:
        queryset = user_option_service.get(user_ids=pending, project=project, key="mail:email")
        for option in (o for o in queryset if o.value and not is_fake_email(o.value)):
            if UserEmail.objects.filter(user=option.user, email=option.value).exists():
                results[option.user_id] = option.value
                pending.discard(option.user_id)
            else:
                pending.discard(option.user_id)
                option.delete()

    if pending:
        users = user_service.get_many(pending)
        for (user_id, email) in [(user.id, user.email) for user in users]:
            if email and not is_fake_email(email):
                results[user_id] = email
                pending.discard(user_id)

    if pending:
        logger.warning(
            f"Could not resolve email addresses for user IDs in {pending}, discarding..."
        )

    return results
