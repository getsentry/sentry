from __future__ import annotations

import abc
from typing import Collection

from sentry.services.hybrid_cloud import InterfaceWithLifecycle, silo_mode_delegation, stubbed
from sentry.services.hybrid_cloud.organization import ApiOrganization
from sentry.services.hybrid_cloud.user import APIUser
from sentry.silo import SiloMode


class AmbiguousUserFromEmail(Exception):
    def __init__(self, email: str, users: Collection[APIUser]) -> None:
        super().__init__(f"Resolved {email!r} to {[user.id for user in users]}")
        self.email = email
        self.users = tuple(users)


class EmailService(InterfaceWithLifecycle):
    @abc.abstractmethod
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
