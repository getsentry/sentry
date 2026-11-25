from typing import TypedDict

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.incidents.metric_detector_quota import get_metric_detector_quota
from sentry.models.organization import Organization


class MetricDetectorQuotaResponse(TypedDict):
    count: int
    limit: int
    hasReachedLimit: bool


@cell_silo_endpoint
class OrganizationMetricDetectorQuotaEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ISSUES

    def get(
        self, request: Request, organization: Organization
    ) -> Response[MetricDetectorQuotaResponse]:
        """
        Return the organization's metric detector limit and how many detectors count toward it.
        """
        quota = get_metric_detector_quota(organization, actor=request.user)
        response: MetricDetectorQuotaResponse = {
            "count": quota.count,
            "limit": quota.limit,
            "hasReachedLimit": quota.has_exceeded,
        }
        return self.respond(response)
