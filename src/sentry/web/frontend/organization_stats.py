from __future__ import absolute_import

from sentry.models import (
    OrganizationMemberType
)
from sentry.web.frontend.base import OrganizationView


class OrganizationStatsView(OrganizationView):
    required_access = OrganizationMemberType.ADMIN

    def get(self, request, organization):
        return self.respond('sentry/organization-stats.html')
