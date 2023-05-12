from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.paginator import DateTimePaginator
from sentry.api.serializers import OrganizationActivitySerializer, serialize
from sentry.models import Activity, OrganizationMemberTeam, Project
from sentry.types.activity import ActivityType


@region_silo_endpoint
class OrganizationActivityEndpoint(OrganizationMemberEndpoint, EnvironmentMixin):
    def get(self, request: Request, organization, member) -> Response:
        # There is an activity record created for both sides of the unmerge
        # operation, so we only need to include one of them here to avoid
        # showing the same entry twice.
        base_qs = Activity.objects.exclude(type=ActivityType.UNMERGE_SOURCE.value).values_list(
            "id", flat=True
        )

        # To make this query efficient, we have to hammer it into a weird format. This table is
        # extremely large and if we are making a query across many projects, in a lot of cases
        # Postgres decides that the best query plan is to iterate backwards on the datetime index.
        # This means it does something close to a table scan to get the results it wants - this can
        # be the case even for orgs with less than a page of activity rows, and often results in
        # queries that take > 30s, which get killed by stomper.
        # To convince Postgres to use the index on `(project_id, datetime)`, it basically needs to
        # see queries that filter on a single project id and then order by datetime. So we replicate
        # the query for every project and UNION ALL them together to get the candidate set of rows.
        # Then we sort these and return the final result. Convoluted, but it improves the query a
        # lot.
        # To make this work well with pagination, we have to also apply the pagination queries to
        # the subqueries.
        cursor = self.get_cursor_from_request(request)
        paginator = DateTimePaginator(base_qs, order_by="-datetime")
        if cursor is not None and cursor.value:
            cursor_value = paginator.value_from_cursor(cursor)
        else:
            cursor_value = 0
        base_qs = paginator.build_queryset(cursor_value, False)

        project_ids = list(
            Project.objects.filter(
                organization=organization,
                teams__in=OrganizationMemberTeam.objects.filter(organizationmember=member).values(
                    "team"
                ),
            ).values_list("id", flat=True)
        )

        union_qs = Activity.objects.none()
        if project_ids:
            projects_qs = [
                base_qs.filter(project_id=project)[: paginator.max_limit] for project in project_ids
            ]

            if len(project_ids) > 1:
                union_qs = union_qs.union(*projects_qs, all=True)
            else:
                union_qs = projects_qs[0]

        # We do `select_related` here to make the unions less heavy. This way we only join these
        # table for the rows we actually want.
        queryset = Activity.objects.filter(id__in=union_qs[: paginator.max_limit]).select_related(
            "project", "group"
        )

        return self.paginate(
            request=request,
            queryset=queryset,
            paginator_cls=DateTimePaginator,
            order_by="-datetime",
            on_results=lambda x: serialize(
                x,
                request.user,
                OrganizationActivitySerializer(
                    environment_func=self._get_environment_func(request, organization.id)
                ),
            ),
        )
