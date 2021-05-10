import re

from django.db import IntegrityError, transaction
from django.db.models import Case, When
from rest_framework.response import Response

from sentry import features
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import ChainPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.dashboard import DashboardListSerializer
from sentry.api.serializers.rest_framework import DashboardSerializer
from sentry.models import Dashboard

MAX_RETRIES = 10
DUPLICATE_TITLE_PATTERN = r"(.*) copy(?:$|\s(\d+))"


class OrganizationDashboardsPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:read", "org:write", "org:admin"],
        "PUT": ["org:read", "org:write", "org:admin"],
        "DELETE": ["org:read", "org:write", "org:admin"],
    }


class OrganizationDashboardsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationDashboardsPermission,)

    def get(self, request, organization):
        """
        Retrieve an Organization's Dashboards
        `````````````````````````````````````

        Retrieve a list of dashboards that are associated with the given organization.
        If on the first page, this endpoint will also include any pre-built dashboards
        that haven't been replaced or removed.

        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.
        :qparam string query: the title of the dashboard being searched for.
        :auth: required
        """
        if not features.has("organizations:dashboards-basic", organization, actor=request.user):
            return Response(status=404)

        dashboards = Dashboard.objects.filter(organization_id=organization.id).select_related(
            "created_by"
        )
        query = request.GET.get("query")
        if query:
            dashboards = dashboards.filter(title__icontains=query)
        prebuilt = Dashboard.get_prebuilt_list(organization, query)

        sort_by = request.query_params.get("sort")
        if sort_by in ("title", "-title"):
            order_by = [
                "-title" if sort_by.startswith("-") else "title",
                "-date_added",
            ]
        elif sort_by in ("dateCreated", "-dateCreated"):
            order_by = "-date_added" if sort_by.startswith("-") else "date_added"
        elif sort_by == "mydashboards":
            order_by = [
                Case(When(created_by_id=request.user.id, then=-1), default="created_by_id"),
                "-date_added",
            ]
        else:
            order_by = "title"
        if not isinstance(order_by, list):
            order_by = [order_by]

        dashboards = dashboards.order_by(*order_by)

        list_serializer = DashboardListSerializer()

        def handle_results(results):
            serialized = []
            dashboards = []
            for item in results:
                if isinstance(item, dict):
                    cloned = item.copy()
                    widgets = cloned.pop("widgets", [])
                    cloned["widgetDisplay"] = [w["displayType"] for w in widgets]
                    serialized.append(cloned)
                else:
                    dashboards.append(item)

            serialized.extend(serialize(dashboards, request.user, serializer=list_serializer))
            return serialized

        return self.paginate(
            request=request,
            sources=[prebuilt, dashboards],
            paginator_cls=ChainPaginator,
            on_results=handle_results,
        )

    def post(self, request, organization, retry=0):
        """
        Create a New Dashboard for an Organization
        ``````````````````````````````````````````

        Create a new dashboard for the given Organization
        :pparam string organization_slug: the slug of the organization the
                                          dashboards belongs to.
        """
        if not features.has("organizations:dashboards-edit", organization, actor=request.user):
            return Response(status=404)

        serializer = DashboardSerializer(
            data=request.data,
            context={
                "organization": organization,
                "request": request,
                "projects": self.get_projects(request, organization),
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        try:
            with transaction.atomic():
                dashboard = serializer.save()
                return Response(serialize(dashboard, request.user), status=201)
        except IntegrityError:
            duplicate = request.data.get("duplicate", False)
            if duplicate and retry < MAX_RETRIES:
                title = request.data["title"]
                match = re.match(DUPLICATE_TITLE_PATTERN, title)
                if match:
                    partial_title = match.group(1)
                    copy_counter = match.group(2)
                    if copy_counter:
                        request.data["title"] = f"{partial_title} copy {int(copy_counter) + 1}"
                    else:
                        request.data["title"] = f"{partial_title} copy 1"
                else:
                    request.data["title"] = f"{title} copy"

                return self.post(request, organization, retry=retry + 1)
            else:
                return Response("Dashboard title already taken", status=409)
