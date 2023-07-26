from __future__ import annotations

import logging
from typing import Iterable, List, Mapping

from sentry.models import Project, UserEmail
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.services.hybrid_cloud.user_option import RpcUserOption, user_option_service

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
        to_delete: List[RpcUserOption] = []
        options = user_option_service.get_many(
            filter={"user_ids": pending, "project_id": project.id, "keys": ["mail:email"]}
        )
        for option in (o for o in options if o.value and not is_fake_email(o.value)):
            if UserEmail.objects.filter(user_id=option.user_id, email=option.value).exists():
                results[option.user_id] = option.value
                pending.discard(option.user_id)
            else:
                pending.discard(option.user_id)
                to_delete.append(option)
        user_option_service.delete_options(option_ids=[o.id for o in to_delete])

    if pending:
        users = user_service.get_many(filter={"user_ids": list(pending)})
        for (user_id, email) in [(user.id, user.email) for user in users]:
            if email and not is_fake_email(email):
                results[user_id] = email
                pending.discard(user_id)

    if pending:
        logger.warning(
            f"Could not resolve email addresses for user IDs in {pending}, discarding..."
        )

    return results
