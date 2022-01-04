from typing import Optional

import sentry_sdk

from sentry.models import User, UserEmail


def resolve_email_to_user(email: str) -> Optional[User]:
    candidate_users = list(
        User.objects.filter(
            id__in=UserEmail.objects.filter(email__iexact=email).values("user"), is_active=True
        )
    )

    if not candidate_users:
        return None
    if len(candidate_users) == 1:
        return candidate_users[0]

    with sentry_sdk.push_scope() as scope:
        scope.level = "warning"
        scope.set_tag("email", email)
        scope.set_extra("user_ids", sorted(user.id for user in candidate_users))
        sentry_sdk.capture_message("Ambiguous email resolution")
    return candidate_users[0]
