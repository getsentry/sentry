from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.issueset import IssueSetSerializer
from sentry.models.issueset import IssueSet
from sentry.models.organization import Organization


class IssueSetsEndpoint(OrganizationEndpoint):
    def get(self, request: Request, organization: Organization) -> Response:
        queryset = IssueSet.objects.filter(organization=organization)
        return Response(serialize(list(queryset), request.user, serializer=IssueSetSerializer()))

    def post(self, request: Request, organization: Organization) -> Response:
        return Response(404)
