from typing import Optional, Sequence, Tuple

from sentry.models import User, UserEmail


class AmbiguousUserFromEmail(Exception):
    def __init__(self, email: str, users: Sequence[User]) -> None:
        super().__init__(f"Resolved {email!r} to {[user.id for user in users]}")
        self.email: str = email
        self.users: Tuple[User] = tuple(users)


def resolve_email_to_user(email: str) -> Optional[User]:
    candidate_users = tuple(
        User.objects.filter(
            id__in=UserEmail.objects.filter(email__iexact=email).values("user"), is_active=True
        )
    )

    if not candidate_users:
        return None
    if len(candidate_users) == 1:
        return candidate_users[0]
    raise AmbiguousUserFromEmail(email, candidate_users)
