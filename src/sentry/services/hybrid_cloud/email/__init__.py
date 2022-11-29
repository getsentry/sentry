from __future__ import annotations

import abc
from dataclasses import dataclass
from typing import Collection, Iterable, Type

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.organization import ApiOrganization, ApiOrganizationMember
from sentry.services.hybrid_cloud.user import APIUser
from sentry.silo import SiloMode
from sentry.utils import metrics


@dataclass
class ApiUserEmail:
    id: int
    user: APIUser
    email: str
    is_verified: bool
    is_primary: bool


class AmbiguousUserFromEmail(Exception):
    def __init__(self, email: str, users: Collection[APIUser]) -> None:
        super().__init__(f"Resolved {email!r} to {[user.id for user in users]}")
        self.email = email
        self.users = tuple(users)


class EmailService(InterfaceWithLifecycle):
    def resolve_email_to_user(
        self, email: str, organization: ApiOrganization | None = None
    ) -> APIUser | None:
        """Resolve an email address to a user profile.

        If no users with the email address are found, return None. If multiple users
        with the email address are found and the steps below cannot disambiguate from
        among them, raise AmbiguousUserFromEmail.

        The disambiguation steps are as follows:

        1. If some email addresses are unverified, exclude them.
        2. If an organization is passed as an argument, prefer users with a membership
           in that organization.
        3. If one user has the email address as the primary address on their account,
           choose that one.

        :param email: the email address to resolve
        :param organization: the organization to prioritize, if any
        :return: the user, if found
        """

        candidates = tuple(self.get_user_emails(email=email))
        if not candidates:
            return None
        return _EmailResolver(self, email, organization).resolve(candidates)

    @abc.abstractmethod
    def get_user_emails(self, *, email: str) -> Iterable[ApiUserEmail]:
        raise NotImplementedError

    @abc.abstractmethod
    def get_members_for_users(
        self, *, organization: ApiOrganization, users: Collection[APIUser]
    ) -> Iterable[ApiOrganizationMember]:
        raise NotImplementedError

    def close(self) -> None:
        pass


def impl_with_db() -> EmailService:
    from sentry.services.hybrid_cloud.email.impl import DatabaseBackedEmailService

    return DatabaseBackedEmailService()


email_service: EmailService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: impl_with_db,
        SiloMode.CONTROL: impl_with_db,
        SiloMode.REGION: stubbed(impl_with_db, SiloMode.CONTROL),
    }
)


@dataclass
class _EmailResolver:
    service: EmailService
    email: str
    organization: ApiOrganization | None

    def resolve(self, candidates: Collection[ApiUserEmail]) -> APIUser:
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

    def if_inconclusive(self, remaining_candidates: Collection[ApiUserEmail]) -> None:
        """Hook to call if no step resolves to a single user."""
        metrics.incr("auth.email_resolution.no_resolution", sample_rate=1.0)

    @dataclass
    class ResolutionStep(abc.ABC):
        parent: _EmailResolver

        @abc.abstractmethod
        def apply(self, candidates: Collection[ApiUserEmail]) -> Iterable[ApiUserEmail]:
            raise NotImplementedError

        def if_conclusive(self, candidates: Collection[ApiUserEmail], choice: ApiUserEmail) -> None:
            """Hook to call if this step resolves to a single user."""
            pass

    class IsVerified(ResolutionStep):
        """Prefer verified email addresses."""

        def apply(self, candidates: Collection[ApiUserEmail]) -> Iterable[ApiUserEmail]:
            return (ue for ue in candidates if ue.is_verified)

        def if_conclusive(self, candidates: Collection[ApiUserEmail], choice: ApiUserEmail) -> None:
            metrics.incr("auth.email_resolution.by_verification", sample_rate=1.0)

    class HasOrgMembership(ResolutionStep):
        """Prefer users who belong to the organization."""

        def apply(self, candidates: Collection[ApiUserEmail]) -> Iterable[ApiUserEmail]:
            if not self.parent.organization:
                return ()

            users_in_org = self.parent.service.get_members_for_users(
                organization=self.parent.organization,
                users=[ue.user for ue in candidates],
            )
            user_ids_in_org = {user.id for user in users_in_org}
            return (ue for ue in candidates if ue.user.id in user_ids_in_org)

        def if_conclusive(self, candidates: Collection[ApiUserEmail], choice: ApiUserEmail) -> None:
            metrics.incr("auth.email_resolution.by_org_membership", sample_rate=1.0)

    class IsPrimary(ResolutionStep):
        """Prefer users whose primary address matches the address in question."""

        def apply(self, candidates: Collection[ApiUserEmail]) -> Iterable[ApiUserEmail]:
            return (ue for ue in candidates if ue.is_primary)

        def if_conclusive(self, candidates: Collection[ApiUserEmail], choice: ApiUserEmail) -> None:
            metrics.incr("auth.email_resolution.by_primary_email", sample_rate=1.0)

    def get_steps(self) -> Iterable[Type[ResolutionStep]]:
        return (
            self.IsVerified,
            self.HasOrgMembership,
            self.IsPrimary,
        )
