from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.models import Repository
from sentry.plugins import bindings


class OrganizationRepositoriesEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        List an Organization's Repositories
        ```````````````````````````````````

        Return a list of version control repositories for a given organization.

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        queryset = Repository.objects.filter(
            organization_id=organization.id,
        )

        status = request.GET.get('status', 'active')
        if status == 'active':
            queryset = queryset.filter(
                status=ObjectStatus.VISIBLE,
            )
        elif status == 'deleted':
            queryset = queryset.exclude(
                status=ObjectStatus.VISIBLE,
            )
        elif status:
            queryset = queryset.none()

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, organization):
        if not request.user.is_authenticated():
            return Response(status=401)

        provider_id = request.DATA.get('provider')
        try:
            provider_cls = bindings.get('repository.provider').get(provider_id)
        except KeyError:
            return Response({
                'error_type': 'validation',
            }, status=400)

        provider = provider_cls(id=provider_id)
        return provider.dispatch(request, organization)
