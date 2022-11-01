from abc import abstractmethod
from dataclasses import dataclass
from typing import Iterable, List, Optional

from sentry.models import Organization, OrganizationMember, OrganizationStatus
from sentry.services.hybrid_cloud import (
    CreateStubFromBase,
    InterfaceWithLifecycle,
    logger,
    silo_mode_delegation,
)
from sentry.silo import SiloMode


@dataclass
class ApiOrganizationMember:
    # This can be null when the user is deleted.
    user_id: Optional[int]
    pass


@dataclass
class ApiOrganization:
    slug: str = ""
    id: int = -1
    # exists iff the organization was queried with a user_id context, and that user_id
    # was confirmed to be a member.
    member: Optional[ApiOrganizationMember] = None


class OrganizationService(InterfaceWithLifecycle):
    @abstractmethod
    def get_organizations(
        self, user_id: Optional[int], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        """
        This method is expected to follow the optionally given user_id, scope, and only_visible options to filter
        an appropriate set.
        :param user_id:
        When null, this should imply the entire set of organizations, not bound by user.  Be certain to authenticate
        users before returning this.
        :param scope:
        :param only_visible:
        :return:
        """
        pass

    @abstractmethod
    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        """
        Used to look up an organization membership by an email, used in very specific edge cases.
        """
        pass

    @abstractmethod
    def get_organization_by_slug(
        self, *, user_id: Optional[int], slug: str, only_visible: bool, allow_stale: bool
    ) -> Optional[ApiOrganization]:
        pass

    def _serialize_member(self, member: OrganizationMember) -> ApiOrganizationMember:
        return ApiOrganizationMember(user_id=member.user.id if member.user is not None else None)

    def _serialize_organization(
        self, org: Organization, user_memberships: Iterable[OrganizationMember] = tuple()
    ) -> ApiOrganization:
        result = ApiOrganization(slug=org.slug, id=org.id)

        for member in user_memberships:
            if member.organization.id == org.id:
                result.member = self._serialize_member(member)
                break

        return result


class DatabaseBackedOrganizationService(OrganizationService):
    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(organization_id=organization_id, email=email)
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

    def get_organization_by_slug(
        self, *, user_id: Optional[int], slug: str, only_visible: bool, allow_stale: bool
    ) -> Optional[ApiOrganization]:
        user_memberships: List[OrganizationMember] = []
        if user_id is not None:
            try:
                user_memberships = [
                    OrganizationMember.objects.get(organization_id=id, user_id=user_id)
                ]
            except OrganizationMember.DoesNotExist:
                pass

        try:
            if allow_stale:
                org = Organization.objects.get_from_cache(slug=slug)
            else:
                org = Organization.objects.get(slug=slug)

            if only_visible and org.status != OrganizationStatus.VISIBLE:
                raise Organization.DoesNotExist
            return self._serialize_organization(org, user_memberships)
        except Organization.DoesNotExist:
            logger.info("Active organization [%s] not found", slug)

        return None

    def close(self) -> None:
        pass

    def get_organizations(
        self, user_id: Optional[int], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        if user_id is None:
            return []
        organizations = self._query_organizations(user_id, scope, only_visible)
        membership = OrganizationMember.objects.filter(user_id=user_id)
        return [self._serialize_organization(o, membership) for o in organizations]

    def _query_organizations(
        self, user_id: int, scope: Optional[str], only_visible: bool
    ) -> List[Organization]:
        from django.conf import settings

        if settings.SENTRY_PUBLIC and scope is None:
            if only_visible:
                return list(Organization.objects.filter(status=OrganizationStatus.ACTIVE))
            else:
                return list(Organization.objects.filter())

        qs = OrganizationMember.objects.filter(user_id=user_id)

        qs = qs.select_related("organization")
        if only_visible:
            qs = qs.filter(organization__status=OrganizationStatus.ACTIVE)

        results = list(qs)

        if scope is not None:
            return [r.organization for r in results if scope in r.get_scopes()]

        return [r.organization for r in results]


StubOrganizationService = CreateStubFromBase(DatabaseBackedOrganizationService)

organization_service: OrganizationService = silo_mode_delegation(
    {
        SiloMode.MONOLITH: lambda: DatabaseBackedOrganizationService(),
        SiloMode.REGION: lambda: DatabaseBackedOrganizationService(),
        SiloMode.CONTROL: lambda: StubOrganizationService(),
    }
)
