import logging
from typing import Iterable, Mapping

from sentry.models import Project, User, UserEmail, UserOption

from .faker import is_fake_email

logger = logging.getLogger("sentry.mail")


def get_email_addresses(user_ids: Iterable[int], project: Project = None) -> Mapping[int, str]:
    """
    Find the best email addresses for a collection of users. If a project is
    provided, prefer their project-specific notification preferences.
    """
    pending = set(user_ids)
    results = {}

    if project:
        queryset = UserOption.objects.filter(project=project, user__in=pending, key="mail:email")
        for option in (o for o in queryset if o.value and not is_fake_email(o.value)):
            if UserEmail.objects.filter(user=option.user, email=option.value).exists():
                results[option.user_id] = option.value
                pending.discard(option.user_id)
            else:
                pending.discard(option.user_id)
                option.delete()

    if pending:
        queryset = User.objects.filter(pk__in=pending, is_active=True)
        for (user_id, email) in queryset.values_list("id", "email"):
            if email and not is_fake_email(email):
                results[user_id] = email
                pending.discard(user_id)

    if pending:
        logger.warning(
            "Could not resolve email addresses for user IDs in %r, discarding...", pending
        )

    return results
