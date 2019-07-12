from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField
from sentry.incidents.logic import create_incident
from sentry.incidents.models import (
    Incident,
    IncidentStatus,
    IncidentType,
)
from sentry.models.group import Group
from sentry.models.project import Project


class IncidentSerializer(serializers.Serializer):
    projects = ListField(
        child=serializers.CharField(),
        required=False,
        default=[],
    )
    groups = ListField(
        child=serializers.CharField(),
        required=True,
        allow_null=False,
    )
    title = serializers.CharField(required=True)
    query = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    dateStarted = serializers.DateTimeField(required=False)
    dateDetected = serializers.DateTimeField(required=False, allow_null=True)

    def validate_projects(self, slugs):
        projects = Project.objects.filter(
            organization=self.context['organization'],
            slug__in=slugs,
        )
        if len(projects) != len(slugs):
            raise serializers.ValidationError('Invalid project slug(s)')
        return list(projects)

    def validate_groups(self, group_ids):
        groups = Group.objects.filter(
            project__organization=self.context['organization'],
            id__in=group_ids,
        ).select_related('project')
        if len(groups) != len(group_ids):
            raise serializers.ValidationError('Invalid group id(s)')
        return list(groups)


class OrganizationIncidentIndexEndpoint(OrganizationEndpoint):
    permission_classes = (IncidentPermission, )

    def get(self, request, organization):
        """
        List Incidents that a User can access within an Organization
        ````````````````````````````````````````````````````````````
        Returns a paginated list of Incidents that a user can access.

        :auth: required
        """
        if not features.has('organizations:incidents', organization, actor=request.user):
            raise ResourceDoesNotExist

        incidents = Incident.objects.fetch_for_organization(
            organization,
            self.get_projects(request, organization),
        )

        query_status = request.GET.get('status')

        if query_status == 'open':
            incidents = incidents.filter(status=IncidentStatus.OPEN.value)
        elif query_status == 'closed':
            incidents = incidents.filter(status=IncidentStatus.CLOSED.value)

        return self.paginate(
            request,
            queryset=incidents,
            order_by='-date_started',
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )

    def post(self, request, organization):
        if not features.has('organizations:incidents', organization, actor=request.user):
            return self.respond(status=404)

        serializer = IncidentSerializer(
            data=request.data,
            context={'organization': organization},
        )

        if serializer.is_valid():

            result = serializer.validated_data
            groups = result['groups']
            all_projects = set(result['projects']) | set(g.project for g in result['groups'])
            if any(p for p in all_projects if not request.access.has_project_access(p)):
                raise PermissionDenied

            incident = create_incident(
                organization=organization,
                type=IncidentType.CREATED,
                title=result['title'],
                query=result.get('query', ''),
                date_started=result.get('dateStarted'),
                date_detected=result.get('dateDetected'),
                projects=result['projects'],
                groups=groups,
                user=request.user,
            )
            return Response(serialize(incident, request.user), status=201)
        return Response(serializer.errors, status=400)
