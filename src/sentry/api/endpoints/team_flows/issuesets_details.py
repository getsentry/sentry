from django.http import Http404
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.serializers.models.issueset import IssueSetSerializer
from sentry.models.issueset import IssueSet
from sentry.models.organization import Organization


class IssueSetDetailsEndpoint(OrganizationEndpoint):
    def convert_args(self, request: Request, organization_slug, issue_set_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, organization_slug, *args, **kwargs)
        try:
            issue_set = IssueSet.objects.get(
                organization=kwargs.get("organization"), id=issue_set_id
            )
        except IssueSet.DoesNotExist:
            raise Http404
        kwargs["issue_set"] = issue_set
        return (args, kwargs)

    def get(self, request: Request, organization: Organization, issue_set: IssueSet) -> Response:
        return Response(serialize(issue_set, request.user, serializer=IssueSetSerializer()))

    def put(self, request: Request, organization: Organization, issue_set: IssueSet) -> Response:
        return Response(404)

    def delete(self, request: Request, organization: Organization, issue_set: IssueSet):
        return Response(404)
