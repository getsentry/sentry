from typing import Any, List

from django.db.models import Q
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.api.serializers.models.project import ProjectSummarySerializer
from sentry.models import Organization, Project, ProjectStatus, Team, User
from sentry.search.utils import tokenize_query


def get_organization_projects(
    organization: Organization,
    user: User,
    is_authenticated: bool,
    query: Any,
    all_projects: bool,
    collapse: Any,
    order_by: List[str],
):
    queryset = Project.objects.filter(organization=organization)

    if is_authenticated:
        queryset = queryset.extra(
            select={
                "is_bookmarked": """exists (
                            select *
                            from sentry_projectbookmark spb
                            where spb.project_id = sentry_project.id and spb.user_id = %s
                        )"""
            },
            select_params=(user.id,),
        )
        order_by.insert(0, "-is_bookmarked")

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
                queryset = queryset.filter(teams__organizationmember__user=user)
            else:
                queryset = queryset.none()

    queryset = queryset.filter(status=ProjectStatus.VISIBLE).distinct()

    # TODO(davidenwang): remove this after frontend requires only paginated projects
    get_all_projects = all_projects == 1

    if get_all_projects:
        queryset = queryset.order_by("slug").select_related("organization")
        return Response(
            serialize(list(queryset), user, ProjectSummarySerializer(collapse=collapse))
        )
    return queryset
