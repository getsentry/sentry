from __future__ import absolute_import

import itertools
from rest_framework import serializers, status
from rest_framework.response import Response

from sentry import features
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.decorators import sudo_required
from sentry.api.serializers import serialize
from sentry.auth import access
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, Team, Organization, OrganizationStatus
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

        Return details on an individual organization.

            {method} {path}

        """
        team_list = Team.objects.get_for_user(
            organization=organization,
            user=request.user,
            with_projects=True,
        )
        team_map = {
            t[0].id: s
            for t, s in zip(
                team_list,
                serialize([t for t, _ in team_list], request.user)
            )
        }

        project_list = list(itertools.chain(*[p for _, p in team_list]))
        project_map = {
            p.id: s
            for p, s in zip(
                project_list,
                serialize(project_list, request.user)
            )
        }

        teams_context = []
        for team, project_list in team_list:
            team_data = team_map[team.id]
            team_data['projects'] = [project_map[p.id] for p in project_list]
            teams_context.append(team_data)

        feature_list = []
        if features.has('organizations:sso', organization, actor=request.user):
            feature_list.append('organizations:sso')

        context = serialize(organization, request.user)
        context['teams'] = teams_context
        context['access'] = access.from_user(request.user, organization).scopes
        context['features'] = feature_list

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

            AuditLogEntry.objects.create(
                organization=organization,
                actor=request.user,
                ip_address=request.META['REMOTE_ADDR'],
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
