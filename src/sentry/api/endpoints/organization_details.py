from __future__ import absolute_import

from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import features
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.api.serializers.models.team import TeamWithProjectsSerializer
from sentry.auth import access
from sentry.models import (
    AuditLogEntryEvent, Organization, OrganizationAccessRequest,
    OrganizationStatus, Team, TeamStatus
)
from sentry.tasks.deletion import delete_organization


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
        team_list = list(Team.objects.filter(
            organization=organization,
            status=TeamStatus.VISIBLE,
        ))

        feature_list = []
        if features.has('organizations:sso', organization, actor=request.user):
            feature_list.append('sso')

        if getattr(organization.flags, 'allow_joinleave'):
            feature_list.append('open-membership')

        context = serialize(organization, request.user)
        context['access'] = access.from_user(request.user, organization).scopes
        context['features'] = feature_list
        context['teams'] = serialize(
            team_list, request.user, TeamWithProjectsSerializer)
        context['pendingAccessRequests'] = OrganizationAccessRequest.objects.filter(
            team__organization=organization,
        ).count()
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
