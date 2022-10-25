from django.http import HttpResponseRedirect
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.superuser import is_active_superuser
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project, ProjectStatus

from .react_page import ReactPageView


def get_projects(request, organization):
    if is_active_superuser(request):
        return list(
            Project.objects.filter(status=ProjectStatus.VISIBLE, organization_id=organization.id)
        )
    else:
        return request.access.projects


class NewestPerformanceIssueView(ReactPageView):
    def handle(self, request: Request, organization, **kwargs) -> Response:
        projects = get_projects(request, organization)
        project_ids = [project.id for project in projects]

        group = (
            Group.objects.filter(
                project_id__in=project_ids,
                status=GroupStatus.UNRESOLVED,
                # performance issue range
                type__gte=1000,
                type__lt=2000,
            )
            .order_by("-first_seen")
            .first()
        )
        if group:
            return HttpResponseRedirect(
                reverse("sentry-organization-issue", args=[organization.slug, group.id])
            )
        # if no group, then redirect to the issues page
        return HttpResponseRedirect(
            reverse("sentry-organization-issue-list", args=[organization.slug])
        )
