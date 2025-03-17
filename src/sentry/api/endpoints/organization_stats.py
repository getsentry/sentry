from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tsdb
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, StatsMixin, region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.team import Team
from sentry.tsdb.base import TSDBModel


@region_silo_endpoint
class OrganizationStatsEndpoint(OrganizationEndpoint, EnvironmentMixin, StatsMixin):
    publish_status = {
        # Deprecated APIs remain private until removed
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ENTERPRISE

    def get(self, request: Request, organization) -> Response:
        """
        Retrieve Event Counts for an Organization
        `````````````````````````````````````````

        .. caution::
           This endpoint may change in the future without notice.

        Return a set of points representing a normalized timestamp and the
        number of events seen in the period.

        :pparam string organization_id_or_slug: the id or slug of the organization for
                                          which the stats should be
                                          retrieved.
        :qparam string stat: the name of the stat to query (``"received"``,
                             ``"rejected"``, ``"blacklisted"``)
        :qparam timestamp since: a timestamp to set the start of the query
                                 in seconds since UNIX epoch.
        :qparam timestamp until: a timestamp to set the end of the query
                                 in seconds since UNIX epoch.
        :qparam string resolution: an explicit resolution to search
                                   for (one of ``10s``, ``1h``, and ``1d``)
        :auth: required
        """
        group = request.GET.get("group", "organization")
        if group == "organization":
            keys = [organization.id]
        elif group == "project":
            team_list = Team.objects.get_for_user(organization=organization, user=request.user)

            project_ids = request.GET.getlist("projectID")
            project_list = []
            if not project_ids:
                for team in team_list:
                    project_list.extend(Project.objects.get_for_user(team=team, user=request.user))
            else:
                project_list.extend(Project.objects.filter(teams__in=team_list, id__in=project_ids))
            keys = list({p.id for p in project_list})
        else:
            raise ValueError("Invalid group: %s" % group)

        if "id" in request.GET:
            id_filter_set = frozenset(map(int, request.GET.getlist("id")))
            keys = [k for k in keys if k in id_filter_set]

        if not keys:
            return Response([])

        stat_model = None
        stat = request.GET.get("stat", "received")
        query_kwargs = {}
        if stat == "received":
            if group == "project":
                stat_model = TSDBModel.project_total_received
            else:
                stat_model = TSDBModel.organization_total_received
        elif stat == "rejected":
            if group == "project":
                stat_model = TSDBModel.project_total_rejected
            else:
                stat_model = TSDBModel.organization_total_rejected
        elif stat == "blacklisted":
            if group == "project":
                stat_model = TSDBModel.project_total_blacklisted
            else:
                stat_model = TSDBModel.organization_total_blacklisted
        elif stat == "generated":
            if group == "project":
                stat_model = TSDBModel.project
                try:
                    query_kwargs["environment_id"] = self._get_environment_id_from_request(
                        request, organization.id
                    )
                except Environment.DoesNotExist:
                    raise ResourceDoesNotExist

        if stat_model is None:
            raise ValueError(f"Invalid group: {group}, stat: {stat}")
        data: dict[int, list[tuple[int, int]]] | list[tuple[int, int]]
        data = tsdb.backend.get_range(
            model=stat_model,
            keys=keys,
            **self._parse_args(request, **query_kwargs),
            tenant_ids={"organization_id": organization.id},
        )

        if group == "organization":
            data = data[organization.id]

        return Response(data)
