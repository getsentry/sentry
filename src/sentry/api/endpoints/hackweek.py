# from drf_spectacular.utils import extend_schema
from rest_framework.request import Request

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.models.organization import Organization
from sentry.models.organizationmemberteam import OrganizationMemberTeam


class TeamMemberIntersectionEndpoint(OrganizationEndpoint):
    # public = {"GET"}

    def get(self, request: Request, organization: Organization):
        """
        Find the intersection of users in teams

        The caller can find which users are in multiple teams. Returns a list of slugs
        """
        teams = request.GET.getlist("team")

        member_slugs = OrganizationMemberTeam.objects.values_list(
            "organizationmember__user__username", flat=True
        ).filter(team__slug__in=teams, organizationmember__organization=organization)
        return self.paginate(request=request, queryset=member_slugs, paginator_cls=OffsetPaginator)
