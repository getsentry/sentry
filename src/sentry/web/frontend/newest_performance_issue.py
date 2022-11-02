from django.http import HttpResponseRedirect
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.superuser import is_active_superuser
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project, ProjectStatus

from .react_page import ReactPageView


def _get_project_ids(request, organization):
    if is_active_superuser(request):
        return Project.objects.filter(
            status=ProjectStatus.VISIBLE, organization_id=organization.id
        ).values_list("id", flat=True)
    else:
        return request.access.visible_project_ids


class NewestPerformanceIssueView(ReactPageView):
    def handle(self, request: Request, organization, **kwargs) -> Response:
        project_ids = _get_project_ids(request, organization)

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
