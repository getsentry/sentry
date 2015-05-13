from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection, Endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.serializers import serialize
from sentry.models import AuditLogEntryEvent, Organization


class OrganizationSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=200, required=True)
    slug = serializers.CharField(max_length=200, required=False)


class OrganizationIndexEndpoint(Endpoint):
    doc_section = DocSection.ORGANIZATIONS
    permission_classes = (OrganizationPermission,)

    def get(self, request):
        """
        List your organizations

        Return a list of organizations available to the authenticated session.

            {method} {path}

        """
        if request.auth:
            if hasattr(request.auth, 'project'):
                organizations = [request.auth.project.organization]
            else:
                organizations = [request.auth.organization]
        else:
            organizations = Organization.objects.get_for_user(
                user=request.user,
            )
        return Response(serialize(organizations, request.user))

    def post(self, request):
        """
        Create a new organization

        Create a new organization.

            {method} {path}
            {{
                "name": "My organization"
            }}

        """
        serializer = OrganizationSerializer(data=request.DATA)

        if serializer.is_valid():
            result = serializer.object

            org = Organization.objects.create(
                name=result['name'],
                slug=result.get('slug'),
                owner=request.user,
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
