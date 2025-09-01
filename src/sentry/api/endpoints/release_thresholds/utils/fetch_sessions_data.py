from __future__ import annotations

from datetime import datetime
from typing import Any

from django.utils.datastructures import MultiValueDict
from rest_framework.request import Request

from sentry import release_health
from sentry.api.bases import FilterParams
from sentry.api.utils import handle_query_errors
from sentry.models.organization import Organization
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.snuba.sessions_v2 import QueryDefinition


def fetch_sessions_data(
    request: Request,
    organization: Organization | RpcOrganization,
    params: FilterParams,
    end: datetime,
    start: datetime,
    field: str | None = "sum(session)",  # alternatively count_unique(user)
):
    """
    This implementation was derived from organization_sessions GET endpoint
    NOTE: Params are derived from the request query and pulls the relevant project/environment objects
    TODO: make fetch generic for other session types
    TODO: capture potential issues with `interval` returning too many results
    """
    with handle_query_errors():
        request_get: dict[str, Any] = request.GET
        query_params: MultiValueDict[str, Any] = MultiValueDict(request_get)
        query_params.setlist("groupBy", ["project", "release", "session.status", "environment"])
        query_params.setlist("field", [field])
        query_params["query"] = " OR ".join(
            [f"release:{version}" for version in query_params.getlist("release")]
        )
        interval = "1hr"
        query_params["interval"] = interval
        query_params["start"] = start.isoformat()
        query_params["end"] = end.isoformat()

        # crash free rates are on a dynamic INTERVAL basis
        # TODO: determine how this affects results for new releases
        query_config = release_health.backend.sessions_query_config(organization)

        # NOTE: params start/end are overwritten by query start/end
        query = QueryDefinition(
            query=query_params,
            params=params,
            query_config=query_config,
        )

        return release_health.backend.run_sessions_query(
            organization.id, query, span_op="release_thresholds.endpoint"
        )
