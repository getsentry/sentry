from django.db.models import Q
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import EnvironmentMixin
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import ProjectSummarySerializer
from sentry.models import Project, ProjectStatus, Team
from sentry.search.utils import tokenize_query

ERR_INVALID_STATS_PERIOD = "Invalid stats_period. Valid choices are '', '24h', '14d', and '30d'"


class OrganizationProjectsEndpoint(OrganizationEndpoint, EnvironmentMixin):
    def get(self, request: Request, organization) -> Response:
        """
        List an Organization's Projects
        ```````````````````````````````

        Return a list of projects bound to a organization.

        :pparam string organization_slug: the slug of the organization for
                                          which the projects should be listed.
        :auth: required
        """
        stats_period = request.GET.get("statsPeriod")
        collapse = request.GET.getlist("collapse", [])
        if stats_period not in (None, "", "1h", "24h", "7d", "14d", "30d"):
            return Response(
                {"error": {"params": {"stats_period": {"message": ERR_INVALID_STATS_PERIOD}}}},
                status=400,
            )
        elif not stats_period:
            # disable stats
            stats_period = None

        if request.auth and not request.user.is_authenticated:
            # TODO: remove this, no longer supported probably
            if hasattr(request.auth, "project"):
                team_list = list(request.auth.project.teams.all())
                queryset = Project.objects.filter(id=request.auth.project.id)
            elif request.auth.organization is not None:
                org = request.auth.organization
                team_list = list(Team.objects.filter(organization=org))
                queryset = Project.objects.filter(teams__in=team_list)
            else:
                return Response(
                    {"detail": "Current access does not point to " "organization."}, status=400
                )
        else:
            queryset = Project.objects.filter(organization=organization)

        order_by = ["slug"]

        if request.user.is_authenticated:
            queryset = queryset.extra(
                select={
                    "is_bookmarked": """exists (
                        select *
                        from sentry_projectbookmark spb
                        where spb.project_id = sentry_project.id and spb.user_id = %s
                    )"""
                },
                select_params=(request.user.id,),
            )
            order_by.insert(0, "-is_bookmarked")

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "query":
                    value = " ".join(value)
                    queryset = queryset.filter(Q(name__icontains=value) | Q(slug__icontains=value))
                elif key == "id":
                    queryset = queryset.filter(id__in=value)
                elif key == "slug":
                    queryset = queryset.filter(slug__in=value)
                elif key == "team":
                    team_list = list(Team.objects.filter(organization=organization, slug__in=value))
                    queryset = queryset.filter(teams__in=team_list)
                elif key == "!team":
                    team_list = list(Team.objects.filter(organization=organization, slug__in=value))
                    queryset = queryset.exclude(teams__in=team_list)
                elif key == "is_member":
                    queryset = queryset.filter(teams__organizationmember__user=request.user)
                else:
                    queryset = queryset.none()

        queryset = queryset.filter(status=ProjectStatus.VISIBLE).distinct()

        # TODO(davidenwang): remove this after frontend requires only paginated projects
        get_all_projects = request.GET.get("all_projects") == "1"

        if get_all_projects:
            queryset = queryset.order_by("slug").select_related("organization")
            return Response(
                serialize(list(queryset), request.user, ProjectSummarySerializer(collapse=collapse))
            )
        else:

            def serialize_on_result(result):
                transaction_stats = request.GET.get("transactionStats")
                session_stats = request.GET.get("sessionStats")
                environment_id = self._get_environment_id_from_request(request, organization.id)
                serializer = ProjectSummarySerializer(
                    environment_id=environment_id,
                    stats_period=stats_period,
                    transaction_stats=transaction_stats,
                    session_stats=session_stats,
                    collapse=collapse,
                )
                return serialize(result, request.user, serializer)

            return self.paginate(
                request=request,
                queryset=queryset,
                order_by=order_by,
                on_results=serialize_on_result,
                paginator_cls=OffsetPaginator,
            )


class OrganizationProjectsCountEndpoint(OrganizationEndpoint, EnvironmentMixin):
    def get(self, request: Request, organization) -> Response:
        queryset = Project.objects.filter(organization=organization)

        all_projects = queryset.count()
        my_projects = queryset.filter(teams__organizationmember__user=request.user).count()

        return Response({"allProjects": all_projects, "myProjects": my_projects})
