from __future__ import absolute_import

from rest_framework import serializers

from sentry import features
from sentry.api.bases.incident import IncidentPermission
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField
from sentry.incidents.models import Incident, IncidentStatus
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.snuba.models import QueryAggregations


class IncidentSerializer(serializers.Serializer):
    projects = ListField(child=serializers.CharField(), required=False, default=[])
    groups = ListField(child=serializers.CharField(), required=True, allow_null=False)
    title = serializers.CharField(required=True)
    query = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    aggregation = serializers.IntegerField(default=QueryAggregations.TOTAL.value)
    dateStarted = serializers.DateTimeField(required=False)
    dateDetected = serializers.DateTimeField(required=False, allow_null=True)

    def validate_projects(self, slugs):
        projects = Project.objects.filter(organization=self.context["organization"], slug__in=slugs)
        if len(projects) != len(slugs):
            raise serializers.ValidationError("Invalid project slug(s)")
        return list(projects)

    def validate_groups(self, group_ids):
        groups = Group.objects.filter(
            project__organization=self.context["organization"], id__in=group_ids
        ).select_related("project")
        if len(groups) != len(group_ids):
            raise serializers.ValidationError("Invalid group id(s)")
        return list(groups)

    def validate_aggregation(self, aggregation):
        try:
            return QueryAggregations(aggregation)
        except ValueError:
            raise serializers.ValidationError(
                "Invalid aggregation, valid values are %s"
                % [item.value for item in QueryAggregations]
            )


class OrganizationIncidentIndexEndpoint(OrganizationEndpoint):
    permission_classes = (IncidentPermission,)

    def get(self, request, organization):
        """
        List Incidents that a User can access within an Organization
        ````````````````````````````````````````````````````````````
        Returns a paginated list of Incidents that a user can access.

        :auth: required
        """
        if not features.has("organizations:incidents", organization, actor=request.user):
            raise ResourceDoesNotExist

        incidents = Incident.objects.fetch_for_organization(
            organization, self.get_projects(request, organization)
        )

        query_status = request.GET.get("status")

        if query_status == "open":
            incidents = incidents.filter(status=IncidentStatus.OPEN.value)
        elif query_status == "closed":
            incidents = incidents.filter(status=IncidentStatus.CLOSED.value)

        return self.paginate(
            request,
            queryset=incidents,
            order_by="-date_started",
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
            default_per_page=25,
        )
