from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Entity, Op, Query

from sentry import analytics
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import SnubaRequestPaginator
from sentry.api.serializers import serialize
from sentry.snuba.dataset import Dataset, EntityKey


@region_silo_endpoint
class ProjectUsersEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project) -> Response:
        """
        List a Project's Users
        ``````````````````````

        Return a list of users seen within this project.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string key: the tag key to look up.
        :auth: required
        :qparam string query: Limit results to users matching the given query.
                              Prefixes should be used to suggest the field to
                              match on: ``id``, ``email``, ``username``, ``ip``.
                              For example, ``query=email:foo@example.com``
        """
        analytics.record(
            "eventuser_endpoint.request",
            project_id=project.id,
            endpoint="sentry.api.endpoints.project_users.get",
        )
        # TODO(isabellaenriquez): replace from here to 50 with snubaquery and Request
        # queryset = EventUser.objects.filter(project_id=project.id)
        where_conditions = [Condition(Column("project_id"), Op.EQ, project.id)]
        if request.GET.get("query"):
            try:
                field, identifier = request.GET["query"].strip().split(":", 1)
                # queryset = queryset.filter(
                #     project_id=project.id,
                #     **{EventUser.attr_from_keyword(field): identifier},
                # )
                where_conditions.append(Condition(Column(field), Op.EQ, identifier))
            except (ValueError, KeyError):
                return Response([])
        query = Query(
            match=Entity(EntityKey.Events.value),
            select=[
                Column("project_id"),
                Column("hash"),
                Column("ident"),
                Column("email"),
                Column("username"),
                Column("name"),
                Column("ip_address"),
                Column("date_added"),
            ],
            where=where_conditions,
        )
        return self.paginate(
            request=request,
            query=query,
            dataset=Dataset.Events.value,
            app_id="sentry.api.endpoints.project_users",
            order_by="-date_added",
            paginator_cls=SnubaRequestPaginator,
            on_results=lambda x: serialize(x, request.user),
        )


"""
cursor is eventuser id in set of eventusers
assuems ascending

first page:
    query = (
        Query("events", Entity"events"))  # idk if this is the proper dataset and entity lol
        .set_select(<all cols>)
        .set_limit(LIMIT)  # defaults to 100
        .set_offset(0)
    )

anything but the first page
    query = (
        Query("events", Entity"events"))  # idk if this is the proper dataset and entity lol
        .set_select(<all cols>)
        .set_where(
            [Condition(Column("id"), Op.GT, cursor.value)]
        )
        .set_limit(LIMIT)  # defaults to 100
        .set_offset(0)
    )


def paginate_snuba_request(
    self,
    request,
    on_results=None,
    paginator=None,
    paginator_cls=Paginator,
    default_per_page=100,
    max_per_page=100,
    cursor_cls=Cursor,
    response_cls=Response,
    response_kwargs=None,
    count_hits=None,
    **paginator_kwargs,
):

XXX(isabella): doesn't look like making the new paginator class will work -- request nor query won't be passed into the paginator class, only exists within the call to the paginate method itself so maybe make a new paginate method specifically for snuba? or might need to make a whole new snubapaginator and snubapaginate method and class
"""
