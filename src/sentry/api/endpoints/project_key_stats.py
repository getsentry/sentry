from django.db.models import F
from django.http import QueryDict
from rest_framework.exceptions import ParseError
from rest_framework.request import Request
from rest_framework.response import Response
from sentry_sdk.api import capture_exception

from sentry.api.base import StatsMixin
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import ProjectKey
from sentry.snuba.outcomes import (
    QueryDefinition,
    massage_outcomes_result,
    run_outcomes_query_timeseries,
)
from sentry.types.ratelimit import RateLimit, RateLimitCategory
from sentry.utils.dates import parse_timestamp
from sentry.utils.outcomes import Outcome


class ProjectKeyStatsEndpoint(ProjectEndpoint, StatsMixin):
    enforce_rate_limit = True
    rate_limits = {
        "GET": {
            RateLimitCategory.IP: RateLimit(20, 1),
            RateLimitCategory.USER: RateLimit(20, 1),
            RateLimitCategory.ORGANIZATION: RateLimit(20, 1),
        }
    }

    def get(self, request: Request, project, key_id) -> Response:
        try:
            key = ProjectKey.objects.get(
                project=project, public_key=key_id, roles=F("roles").bitor(ProjectKey.roles.store)
            )
        except ProjectKey.DoesNotExist:
            raise ResourceDoesNotExist

        # Outcomes queries are coupled to Django's QueryDict :(
        query_data = QueryDict(mutable=True)
        query_data.setlist("field", ["sum(quantity)"])
        query_data.setlist(
            "outcome",
            [
                Outcome.ACCEPTED.api_name(),
                Outcome.FILTERED.api_name(),
                Outcome.RATE_LIMITED.api_name(),
            ],
        )
        query_data["groupBy"] = "outcome"
        query_data["category"] = "error"
        query_data["key_id"] = key.id

        try:
            stats_params = self._parse_args(request)
        except Exception:
            raise ParseError(detail="Invalid request data")

        query_data["end"] = stats_params["end"].isoformat()
        query_data["start"] = stats_params["start"].isoformat()
        query_data["interval"] = request.GET.get("resolution", "1d")

        try:
            query_definition = QueryDefinition(
                query_data,
                {"organization_id": project.organization_id},
            )
            results = massage_outcomes_result(
                query_definition, [], run_outcomes_query_timeseries(query_definition)
            )
        except Exception:
            raise ParseError(detail="Invalid request data")

        # Initialize the response results.
        response = []
        for time_string in results["intervals"]:
            response.append(
                {
                    "ts": int(parse_timestamp(time_string).timestamp()),
                    "total": 0,
                    "dropped": 0,
                    "accepted": 0,
                    "filtered": 0,
                }
            )

        # We rely on groups and intervals being index aligned
        for group_result in results["groups"]:
            key = None
            grouping = group_result["by"]["outcome"]
            if grouping == Outcome.RATE_LIMITED.api_name():
                key = "dropped"
            elif grouping == Outcome.FILTERED.api_name():
                key = "filtered"
            elif grouping == Outcome.ACCEPTED.api_name():
                key = "accepted"
            else:
                capture_exception(
                    ValueError(f"Unexpected outcome result in project key stats {grouping}")
                )

            if key:
                # We rely on series being index aligned with intervals.
                for i, value in enumerate(group_result["series"]["sum(quantity)"]):
                    response[i][key] += value
                    response[i]["total"] += value

        return Response(response)
