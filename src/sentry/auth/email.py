import abc
from dataclasses import dataclass
from typing import Callable, Iterable, Optional, Sequence

from sentry.models import Organization, OrganizationMember, User, UserEmail


@dataclass
class AmbiguousUserResolution(Exception):
    users: Sequence[User]


@dataclass
class EmailResolutionStrategy(abc.ABC):
    email: str

    @property
    def verified_only(self):
        """Whether we should consider only verified email addresses.

        Compare to placing `is_verified` in the list of steps, which
        would still resolve from a non-verified address unless there
        is a verified one.
        """
        return False

    def resolve(self) -> Optional[User]:
        """Pick the user best matching the email address."""

        candidates = tuple(UserEmail.objects.filter(email__iexact=self.email, user__is_active=True))
        if self.verified_only:
            candidates = self.is_verified(candidates)

        if not candidates:
            return None
        return self._apply_steps(candidates)

    def _apply_steps(self, candidates: Sequence[UserEmail]) -> User:
        # Start with a no-op step, in case there is only one candidate to start
        steps = [lambda c: c] + list(self.get_steps())

        for step in steps:
            last_candidates = candidates
            candidates = tuple(step(candidates))
            if len(candidates) == 1:
                # Success: We've narrowed down to only one candidate
                return candidates[0].user
            if len(candidates) == 0:
                # If the step eliminated all, ignore it and go to the next step
                candidates = last_candidates

        raise AmbiguousUserResolution([ue.user for ue in candidates])

    @abc.abstractmethod
    def get_steps(self) -> Iterable[Callable]:
        raise NotImplementedError

    def is_verified(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
        """Prefer verified email addresses."""
        return tuple(ue for ue in candidates if ue.is_verified)


@dataclass
class AuthHelperResolution(EmailResolutionStrategy):
    organization: Organization

    def _has_org_membership(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
        """Prefer users who belong to the organization."""
        query = OrganizationMember.objects.filter(
            organization=self.organization, user__in=[ue.user for ue in candidates]
        )
        users_in_org = {user_id for (user_id,) in query.values_list("user")}
        return (ue for ue in candidates if ue.user.id in users_in_org)

    def get_steps(self) -> Iterable[Callable]:
        return (self.is_verified, self._has_org_membership)


@dataclass
class IdentityViewResolution(EmailResolutionStrategy):
    request_user: User

    @property
    def verified_only(self):
        return True

    def _is_logged_in_user(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
        if self.request_user.is_authenticated:
            return (ue for ue in candidates if ue.user == self.request_user)
        return ()

    def _is_primary_address(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
        return (ue for ue in candidates if ue.user.email == self.email)

    def get_steps(self) -> Iterable[Callable]:
        return (self._is_logged_in_user, self._is_primary_address)
