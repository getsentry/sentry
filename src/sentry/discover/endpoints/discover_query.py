import logging
from copy import deepcopy
from functools import partial

from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import GenericOffsetPaginator
from sentry.discover.utils import transform_aliases_and_query
from sentry.utils import snuba
from sentry.utils.compat import map

from .serializers import DiscoverQuerySerializer

logger = logging.getLogger(__name__)


class DiscoverQueryPermission(OrganizationPermission):
    scope_map = {"POST": ["org:read", "project:read"]}


class DiscoverQueryEndpoint(OrganizationEndpoint):
    permission_classes = (DiscoverQueryPermission,)

    def has_feature(self, request, organization):
        return features.has(
            "organizations:discover", organization, actor=request.user
        ) or features.has("organizations:discover-basic", organization, actor=request.user)

    def handle_results(self, snuba_results, requested_query, projects):
        if "project.name" in requested_query["selected_columns"]:
            project_name_index = requested_query["selected_columns"].index("project.name")
            snuba_results["meta"].insert(
                project_name_index, {"name": "project.name", "type": "String"}
            )
            if "project.id" not in requested_query["selected_columns"]:
                snuba_results["meta"] = [
                    field for field in snuba_results["meta"] if field["name"] != "project.id"
                ]

            for result in snuba_results["data"]:
                if "project.id" in result:
                    result["project.name"] = projects[result["project.id"]]
                    if "project.id" not in requested_query["selected_columns"]:
                        del result["project.id"]

        if "project.name" in requested_query["groupby"]:
            project_name_index = requested_query["groupby"].index("project.name")
            snuba_results["meta"].insert(
                project_name_index, {"name": "project.name", "type": "String"}
            )
            if "project.id" not in requested_query["groupby"]:
                snuba_results["meta"] = [
                    field for field in snuba_results["meta"] if field["name"] != "project.id"
                ]

            for result in snuba_results["data"]:
                if "project.id" in result:
                    result["project.name"] = projects[result["project.id"]]
                    if "project.id" not in requested_query["groupby"]:
                        del result["project.id"]

        # Convert snuba types to json types
        for col in snuba_results["meta"]:
            col["type"] = snuba.get_json_type(col.get("type"))

        return snuba_results

    def do_query(self, projects, request, **kwargs):
        requested_query = deepcopy(kwargs)

        selected_columns = kwargs["selected_columns"]
        groupby_columns = kwargs["groupby"]

        if "project.name" in requested_query["selected_columns"]:
            selected_columns.remove("project.name")
            if "project.id" not in selected_columns:
                selected_columns.append("project.id")

        if "project.name" in requested_query["groupby"]:
            groupby_columns.remove("project.name")
            if "project.id" not in groupby_columns:
                groupby_columns.append("project.id")

        for aggregation in kwargs["aggregations"]:
            if aggregation[1] == "project.name":
                aggregation[1] = "project.id"

        if not kwargs["aggregations"]:

            data_fn = partial(transform_aliases_and_query, referrer="discover", **kwargs)
            return self.paginate(
                request=request,
                on_results=lambda results: self.handle_results(results, requested_query, projects),
                paginator=GenericOffsetPaginator(data_fn=data_fn),
                max_per_page=1000,
            )
        else:
            snuba_results = transform_aliases_and_query(referrer="discover", **kwargs)
            return Response(
                self.handle_results(snuba_results, requested_query, projects), status=200
            )

    def post(self, request, organization):
        if not self.has_feature(request, organization):
            return Response(status=404)
        logger.info("discover1.request", extra={"organization_id": organization.id})

        try:
            requested_projects = set(map(int, request.data.get("projects", [])))
        except (ValueError, TypeError):
            raise ResourceDoesNotExist()
        projects = self._get_projects_by_id(requested_projects, request, organization)

        serializer = DiscoverQuerySerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        serialized = serializer.validated_data

        has_aggregations = len(serialized.get("aggregations")) > 0

        selected_columns = (
            serialized.get("conditionFields", []) + []
            if has_aggregations
            else serialized.get("fields", [])
        )

        projects_map = {}
        for project in projects:
            projects_map[project.id] = project.slug

        # Make sure that all selected fields are in the group by clause if there
        # are aggregations
        groupby = serialized.get("groupby") or []
        fields = serialized.get("fields") or []
        if has_aggregations:
            for field in fields:
                if field not in groupby:
                    groupby.append(field)

        return self.do_query(
            projects=projects_map,
            start=serialized.get("start"),
            end=serialized.get("end"),
            groupby=groupby,
            selected_columns=selected_columns,
            conditions=serialized.get("conditions"),
            orderby=serialized.get("orderby"),
            limit=serialized.get("limit"),
            aggregations=serialized.get("aggregations"),
            rollup=serialized.get("rollup"),
            filter_keys={"project.id": list(projects_map.keys())},
            arrayjoin=serialized.get("arrayjoin"),
            request=request,
            turbo=serialized.get("turbo"),
        )
