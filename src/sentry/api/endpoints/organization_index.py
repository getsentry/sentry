from __future__ import absolute_import

from django.db.models import Q
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import roles
from sentry.api.base import DocSection, Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import (
    AuditLogEntryEvent, Organization, OrganizationMember, OrganizationStatus
)
from sentry.utils.apidocs import scenario, attach_scenarios


@scenario('ListYourOrganizations')
def list_your_organizations_scenario(runner):
    runner.request(
        method='GET',
        path='/organizations/'
    )


class OrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.CharField(max_length=200, required=False)


class OrganizationIndexEndpoint(Endpoint):
    doc_section = DocSection.ORGANIZATIONS
    permission_classes = (OrganizationPermission,)

    @attach_scenarios([list_your_organizations_scenario])
    def get(self, request):
        """
        List your Organizations
        ```````````````````````

        Return a list of organizations available to the authenticated
        session.  This is particularly useful for requests with an
        user bound context.  For API key based requests this will
        only return the organization that belongs to the key.

        :qparam bool member: restrict results to organizations which you have
                             membership

        :auth: required
        """
        member_only = request.GET.get('member') in ('1', 'true')

        queryset = Organization.objects.filter(
            status=OrganizationStatus.VISIBLE,
        )

        if request.auth:
            if hasattr(request.auth, 'project'):
                queryset = queryset.filter(
                    id=request.auth.project.organization_id
                )
            elif request.auth.organization is not None:
                queryset = queryset.filter(
                    id=request.auth.organization.id
                )
        elif member_only or not request.is_superuser():
            queryset = queryset.filter(
                id__in=OrganizationMember.objects.filter(
                    user=request.user,
                ).values('organization'),
            )

        query = request.GET.get('query')
        if query:
            queryset = queryset.filter(
                Q(name__icontains=query) | Q(slug__icontains=query),
            )

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by='name',
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    # XXX: endpoint useless for end-users as it needs user context.
    def post(self, request):
        """
        Create a New Organization
        `````````````````````````

        Create a new organization owned by the request's user.  To create
        an organization only the name is required.

        :param string name: the human readable name for the new organization.
        :param string slug: the unique URL slug for this organization.  If
                            this is not provided a slug is automatically
                            generated based on the name.
        :auth: required, user-context-needed
        """
        if not request.user.is_authenticated():
            return Response({'detail': 'This endpoint requires user info'},
                            status=401)

        serializer = OrganizationSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            org = Organization.objects.create(
                name=result['name'],
                slug=result.get('slug'),
            )

            OrganizationMember.objects.create(
                user=request.user,
                organization=org,
                role=roles.get_top_dog().id,
            )

            self.create_audit_entry(
                request=request,
                organization=org,
                target_object=org.id,
                event=AuditLogEntryEvent.ORG_ADD,
                data=org.get_audit_log_data(),
            )

            return Response(serialize(org, request.user), status=201)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
