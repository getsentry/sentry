from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import (
    DetailedOrganizationSerializer
)
from sentry.models import (
    AuditLogEntryEvent, Organization,
    OrganizationStatus
)
from sentry.tasks.deletion import delete_organization


ERR_DEFAULT_ORG = 'You cannot remove the default organization.'


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ('name', 'slug')

    def validate_slug(self, attrs, source):
        value = attrs[source]
        if Organization.objects.filter(slug=value).exclude(id=self.object.id):
            raise serializers.ValidationError('The slug "%s" is already in use.' % (value,))
        return attrs


class OrganizationDetailsEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    def get(self, request, organization):
        """
        Retrieve an organization

        Return details on an individual organization including various details
        such as membership access, features, and teams.

            {method} {path}

        """
        context = serialize(
            organization,
            request.user,
            DetailedOrganizationSerializer(),
        )
        return Response(context)

    @sudo_required
    def put(self, request, organization):
        """
        Update an organization

        Update various attributes and configurable settings for the given
        organization.

            {method} {path}
            {{
              "name": "My Organization Name"
            }}

        """
        serializer = OrganizationSerializer(organization, data=request.DATA,
                                            partial=True)
        if serializer.is_valid():
            organization = serializer.save()

            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=organization.id,
                event=AuditLogEntryEvent.ORG_EDIT,
                data=organization.get_audit_log_data(),
            )

            return Response(serialize(organization, request.user))

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @sudo_required
    def delete(self, request, organization):
        """
        Delete an organization

        Schedules an organization for deletion.

            {method} {path}

        **Note:** Deletion happens asynchronously and therefor is not immediate.
        However once deletion has begun the state of a project changes and will
        be hidden from most public views.
        """
        if organization.is_default:
            return Response({'detail': ERR_DEFAULT_ORG}, status=400)

        updated = Organization.objects.filter(
            id=organization.id,
            status=OrganizationStatus.VISIBLE,
        ).update(status=OrganizationStatus.PENDING_DELETION)
        if updated:
            delete_organization.delay(
                object_id=organization.id,
                countdown=60 * 5,
            )

        return Response(status=204)
