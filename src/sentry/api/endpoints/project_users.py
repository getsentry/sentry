from datetime import timedelta

from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response
from snuba_sdk import Column, Condition, Entity, Function, Op, Query

from sentry import analytics
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.paginator import SnubaRequestPaginator
from sentry.api.serializers import serialize
from sentry.snuba.dataset import Dataset, EntityKey
from sentry.utils.eventuser import EventUser

QUERY_TO_SNUBA_FIELD_MAPPING = {
    "id": "user_id",
    "username": "user_name",
    "email": "user_email",
    "ip": ["ip_address_v4", "ip_address_v6"],
    "date_created": "timestamp",
}

REFERRER = "sentry.api.endpoints.project_users"


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
        now = timezone.now()
        where_conditions = [
            Condition(Column("project_id"), Op.EQ, project.id),
            Condition(Column("timestamp"), Op.GTE, now - timedelta(days=90)),  # required apparently
            Condition(Column("timestamp"), Op.LT, now),
        ]
        if request.GET.get("query"):
            try:
                field, identifier = request.GET["query"].strip().split(":", 1)
                if field == "ip":
                    where_conditions.append(
                        Condition(
                            Function(
                                "or",
                                parameters=[
                                    Function(
                                        "equals",
                                        parameters=[
                                            Column("ip_address_v4"),
                                            Function("IPv4StringToNum", parameters=[identifier]),
                                        ],
                                    ),
                                    Function(
                                        "equals",
                                        parameters=[
                                            Column("ip_address_v6"),
                                            Function("IPv6StringToNum", parameters=[identifier]),
                                        ],
                                    ),
                                ],
                            ),
                            Op.EQ,
                            1,
                        )
                    )
                else:
                    where_conditions.append(
                        Condition(
                            Column(QUERY_TO_SNUBA_FIELD_MAPPING.get(field, field)),
                            Op.EQ,
                            identifier,
                        )
                    )
            except (ValueError, KeyError):
                return Response([])
        query = Query(
            match=Entity(EntityKey.Events.value),
            select=[
                Column("project_id"),
                Column("group_id"),
                Column("ip_address_v6"),
                Column("ip_address_v4"),
                Column("event_id"),
                Column("user_id"),
                Column("user"),
                Column("user_name"),
                Column("user_email"),
                Column("timestamp"),
            ],
            where=where_conditions,
        )
        return self.paginate(
            request=request,
            query=query,
            dataset=Dataset.Events.value,
            app_id=REFERRER,
            tenant_ids={
                "referrer": REFERRER,
                "organization_id": project.organization.id,
            },
            order_by="-timestamp",
            paginator_cls=SnubaRequestPaginator,
            converter=convert_to_event_user,
            on_results=lambda x: serialize(x, request.user),
        )


def convert_to_event_user(snuba_results):
    eventusers = []
    for result in snuba_results:
        name = result.get("name", result.get("user_email", result.get("user_name")))
        ip_address = result.get("ip_address_v4", result.get("ip_address_v6"))
        eventusers.append(
            EventUser(
                project_id=result["project_id"],
                email=result["user_email"],
                username=result["user_name"],
                name=name,
                ip_address=ip_address,
                date_created=result["timestamp"],
                id=int(result["user_id"]),
            ).serialize()
        )
    return eventusers
