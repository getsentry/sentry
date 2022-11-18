from typing import List, Optional, cast

from sentry.models import Organization, OrganizationMember, OrganizationStatus
from sentry.services.hybrid_cloud import logger
from sentry.services.hybrid_cloud.organization_service import (
    ApiOrganization,
    ApiOrganizationMember,
    ApiUserOrganizationContext,
    OrganizationService,
)


class DatabaseBackedOrganizationService(OrganizationService):
    def check_membership_by_id(
        self, organization_id: int, user_id: int
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(
                organization_id=organization_id, user_id=user_id
            )
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

    def get_organization_by_id(
        self, *, id: int, user_id: Optional[int]
    ) -> Optional[ApiUserOrganizationContext]:
        membership: Optional[ApiOrganizationMember] = None
        if user_id is not None:
            try:
                om = OrganizationMember.objects.get(organization_id=id, user_id=user_id)
                membership = self._serialize_member(om)
            except OrganizationMember.DoesNotExist:
                pass

        try:
            org = Organization.objects.get(id=id)
        except Organization.DoesNotExist:
            return None

        return ApiUserOrganizationContext(
            user_id=user_id, organization=self._serialize_organization(org), member=membership
        )

    def check_membership_by_email(
        self, organization_id: int, email: str
    ) -> Optional[ApiOrganizationMember]:
        try:
            member = OrganizationMember.objects.get(organization_id=organization_id, email=email)
        except OrganizationMember.DoesNotExist:
            return None

        return self._serialize_member(member)

    def check_organization_by_slug(self, *, slug: str, only_visible: bool) -> Optional[int]:
        try:
            org = Organization.objects.get_from_cache(slug=slug)
            if only_visible and org.status != OrganizationStatus.VISIBLE:
                raise Organization.DoesNotExist
            return cast(int, org.id)
        except Organization.DoesNotExist:
            logger.info("Organization by slug [%s] not found", slug)

        return None

    def close(self) -> None:
        pass

    def get_organizations(
        self, user_id: Optional[int], scope: Optional[str], only_visible: bool
    ) -> List[ApiOrganization]:
        if user_id is None:
            return []
        organizations = self._query_organizations(user_id, scope, only_visible)
        return [self._serialize_organization(o) for o in organizations]

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
