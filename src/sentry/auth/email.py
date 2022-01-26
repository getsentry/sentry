import abc
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence, Tuple, Type

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

        for step_cls in self.get_steps():
            step = step_cls(self)
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

        self.if_inconclusive(candidates)
        raise AmbiguousUserFromEmail(self.email, [ue.user for ue in candidates])

    def if_inconclusive(self, remaining_candidates: Sequence[UserEmail]) -> None:
        """Hook to call if no step resolves to a single user."""
        metrics.incr("auth.email_resolution.no_resolution", sample_rate=1.0)

    @dataclass
    class ResolutionStep(abc.ABC):
        parent: "_EmailResolver"

        @abc.abstractmethod
        def apply(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
            raise NotImplementedError

        def if_conclusive(self, candidates: Sequence[UserEmail], choice: UserEmail) -> None:
            """Hook to call if this step resolves to a single user."""
            pass

    class IsVerified(ResolutionStep):
        """Prefer verified email addresses."""

        def apply(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
            return (ue for ue in candidates if ue.is_verified)

        def if_conclusive(self, candidates: Sequence[UserEmail], choice: UserEmail) -> None:
            metrics.incr("auth.email_resolution.by_verification", sample_rate=1.0)

    class HasOrgMembership(ResolutionStep):
        """Prefer users who belong to the organization."""

        def apply(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
            if not self.parent.organization:
                return ()
            query = OrganizationMember.objects.filter(
                organization=self.parent.organization, user__in=[ue.user for ue in candidates]
            )
            users_in_org = set(query.values_list("user", flat=True))
            return (ue for ue in candidates if ue.user.id in users_in_org)

        def if_conclusive(self, candidates: Sequence[UserEmail], choice: UserEmail) -> None:
            metrics.incr("auth.email_resolution.by_org_membership", sample_rate=1.0)

    class IsPrimary(ResolutionStep):
        """Prefer users whose primary address matches the address in question."""

        def apply(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
            return (ue for ue in candidates if ue.is_primary())

        def if_conclusive(self, candidates: Sequence[UserEmail], choice: UserEmail) -> None:
            metrics.incr("auth.email_resolution.by_primary_email", sample_rate=1.0)

    def get_steps(self) -> Iterable[Type]:
        return (
            self.IsVerified,
            self.HasOrgMembership,
            self.IsPrimary,
        )
