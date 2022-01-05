from dataclasses import dataclass
from typing import Iterable, Optional, Sequence

import sentry_sdk

from sentry.models import Organization, OrganizationMember, User, UserEmail


def resolve_email_to_user(
    email: str, organization: Optional[Organization] = None
) -> Optional[User]:
    candidates = tuple(
        user_email
        for user_email in UserEmail.objects.filter(email__iexact=email)
        if user_email.user.is_active
    )
    if not candidates:
        return None
    return _EmailResolver(email, organization).resolve(candidates)


@dataclass
class _EmailResolver:
    email: str
    organization: Optional[Organization]

    def resolve(self, candidates: Sequence[UserEmail]) -> User:
        """Pick the user best matching the email address."""
        for step in self._STEPS:
            last_candidates = candidates
            candidates = tuple(step(self, candidates))
            if len(candidates) == 1:
                # Success: We've narrowed down to only one candidate
                return candidates[0].user
            if len(candidates) == 0:
                # If the step eliminated all, ignore it and go to the next step
                candidates = last_candidates

        return self._resolve_arbitrarily(candidates)

    def _resolve_arbitrarily(self, candidates: Sequence[UserEmail]):
        """Pick a user arbitrarily after the resolution steps have failed."""
        with sentry_sdk.push_scope() as scope:
            scope.level = "warning"
            scope.set_tag("email", self.email)
            scope.set_extra("user_ids", sorted(candidate.user.id for candidate in candidates))
            sentry_sdk.capture_message("Ambiguous email resolution")
        return candidates[0].user

    # Step definitions below

    def _first_pass(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
        """Null step, in case there is only one candidate to start."""
        return candidates

    def _is_verified(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
        """Prefer verified email addresses."""
        return (ue for ue in candidates if ue.is_verified)

    def _has_org_membership(self, candidates: Sequence[UserEmail]) -> Iterable[UserEmail]:
        """Prefer users who belong to the organization."""
        if not self.organization:
            return candidates
        query = OrganizationMember.objects.filter(
            organization=self.organization, user__in=[ue.user for ue in candidates]
        )
        users_in_org = {user_id for (user_id,) in query.values_list("user")}
        return (ue for ue in candidates if ue.user.id in users_in_org)

    _STEPS = (
        _first_pass,
        _is_verified,
        _has_org_membership,
    )
