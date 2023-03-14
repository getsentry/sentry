from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from rest_framework.request import Request

from sentry.models.group import Group, GroupStatus

from .react_page import ReactPageView


class NewestPerformanceIssueView(ReactPageView):
    def handle(self, request: Request, organization, **kwargs) -> HttpResponse:
        group = (
            Group.objects.filter(
                project_id__in=request.access.accessible_project_ids,
                status=GroupStatus.UNRESOLVED,
                # performance issue range
                type__gte=1000,
                type__lt=2000,
            )
            .order_by("-first_seen")
            .first()
        )
        # if no group, then redirect to the issues page
        url = reverse("sentry-organization-issue-list", args=[organization.slug])
        if group:
            url = reverse("sentry-organization-issue", args=[organization.slug, group.id])
        return HttpResponseRedirect(organization.absolute_url(url))
