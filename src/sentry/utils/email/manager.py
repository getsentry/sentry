from __future__ import annotations

import logging
from collections.abc import Iterable, Mapping

from sentry.models.project import Project
from sentry.users.services.user.model import UserIdEmailArgs
from sentry.users.services.user.service import user_service
from sentry.users.services.user_option import RpcUserOption, user_option_service

from .faker import is_fake_email

logger = logging.getLogger("sentry.mail")


def get_email_addresses(
    user_ids: Iterable[int], project: Project | None = None, only_verified: bool = False
) -> Mapping[int, str]:
    """
    Find the best email addresses for a collection of users. If a project is
    provided, prefer their project-specific notification preferences. Can also
    optionally filter to only returning verified email addresses.
    """
    pending = set(user_ids)
    results = {}

    if project:
        to_delete: list[RpcUserOption] = []
        options = user_option_service.get_many(
            filter={"user_ids": pending, "project_id": project.id, "keys": ["mail:email"]}
        )

        user_id_emails = []
        for option in (o for o in options if o.value and not is_fake_email(o.value)):
            user_id_emails.append(UserIdEmailArgs(user_id=int(option.user_id), email=option.value))

        user_id_emails_exists = user_service.verify_user_emails(
            user_id_emails=user_id_emails, only_verified=only_verified
        )

        for user_id_key in user_id_emails_exists.keys():
            user_id = int(user_id_key)
            if user_id_emails_exists[user_id_key].exists:
                results[user_id] = user_id_emails_exists[user_id_key].email
                pending.discard(user_id)
            else:
                pending.discard(user_id)
                to_delete.append(option)
        user_option_service.delete_options(option_ids=[o.id for o in to_delete])

    if pending:
        users = user_service.get_many_by_id(ids=list(pending))
        for user_id, email in [(user.id, user.email) for user in users]:
            if email and not is_fake_email(email):
                results[user_id] = email
                pending.discard(user_id)

    if pending:
        logger.warning(
            "Could not resolve email addresses for user IDs in %s, discarding...", pending
        )

    return results
