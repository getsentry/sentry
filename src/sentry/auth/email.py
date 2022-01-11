import abc
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence, Tuple

from sentry.models import Organization, OrganizationMember, User, UserEmail
from sentry.utils import metrics


class AmbiguousUserFromEmail(Exception):
    def __init__(self, email: str, users: Sequence[User]) -> None:
        super().__init__(f"Resolved {email!r} to {[user.id for user in users]}")
        self.email: str = email
        self.users: Tuple[User] = tuple(users)


def resolve_email_to_user(
    email: str, organization: Optional[Organization] = None
) -> Optional[User]:
    candidates = tuple(UserEmail.objects.filter(email__iexact=email, user__is_active=True))
    if not candidates:
        return None
    return _EmailResolver(email, organization).resolve(candidates)


@dataclass
class _EmailResolver:
    email: str
    organization: Optional[Organization]

    def resolve(self, candidates: Sequence[UserEmail]) -> User:
        """Pick the user best matching the email address."""

        if not candidates:
            raise ValueError
        if len(candidates) == 1:
            (unique_email,) = candidates
            return unique_email.user

        for step in self.get_steps():
            last_candidates = candidates
            candidates = tuple(step.apply(candidates))
            if len(candidates) == 1:
                # Success: We've narrowed down to only one candidate
                (choice,) = candidates
                step.if_conclusive(last_candidates, choice)
                return choice.user
            if len(candidates) == 0:
                # If the step eliminated all, ignore it and go to the next step
                candidates = last_candidates
            step.if_inconclusive(candidates)

        raise AmbiguousUserFromEmail(self.email, [ue.user for ue in candidates])

    class ResolutionStep(abc.ABC):
        @abc.abstractmethod
        def apply(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
            raise NotImplementedError

        def if_conclusive(self, candidates: Sequence[UserEmail], choice: UserEmail) -> None:
            """Hook to call if this step resolves to a single user."""
            pass

        def if_inconclusive(self, remaining_candidates: Sequence[UserEmail]) -> None:
            """Hook to call if this step doesn't resolve to a single user."""
            pass

    class IsVerified(ResolutionStep):
        """Prefer verified email addresses."""

        def apply(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
            return (ue for ue in candidates if ue.is_verified)

        def if_conclusive(self, candidates: Sequence[UserEmail], choice: UserEmail) -> None:
            metrics.incr("auth.email_resolution.by_verification", sample_rate=1.0)

    @dataclass
    class HasOrgMembership(ResolutionStep):
        """Prefer users who belong to the organization."""

        organization: Optional[Organization]

        def apply(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
            if not self.organization:
                return ()
            query = OrganizationMember.objects.filter(
                organization=self.organization, user__in=[ue.user for ue in candidates]
            )
            users_in_org = {user_id for (user_id,) in query.values_list("user")}
            return (ue for ue in candidates if ue.user.id in users_in_org)

        def if_conclusive(self, candidates: Sequence[UserEmail], choice: UserEmail) -> None:
            metrics.incr("auth.email_resolution.by_org_membership", sample_rate=1.0)

        def if_inconclusive(self, remaining_candidates: Sequence[UserEmail]) -> None:
            metrics.incr("auth.email_resolution.no_resolution", sample_rate=1.0)

    def get_steps(self) -> Iterable[ResolutionStep]:
        return (
            self.IsVerified(),
            self.HasOrgMembership(self.organization),
        )
