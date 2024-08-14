from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from rest_framework.request import Request

from sentry.models.group import Group, GroupStatus
from sentry.web.frontend.base import OrganizationView, region_silo_view


@region_silo_view
class NewestIssueView(OrganizationView):
    def handle(self, request: Request, organization, issue_type="error", **kwargs) -> HttpResponse:
        issue_list_url = organization.absolute_url(
            reverse("sentry-organization-issue-list", args=[organization.slug])
        )
        if issue_type == "error":
            range = (0, 1000)
        if issue_type == "performance":
            range = (1000, 2000)
        elif issue_type == "profile":
            range = (2000, 3000)
        else:
            # bad range so redirect to the issues page
            return HttpResponseRedirect(issue_list_url)

        group = (
            Group.objects.filter(
                project_id__in=request.access.accessible_project_ids,
                status=GroupStatus.UNRESOLVED,
                type__gte=range[0],
                type__lt=range[1],
            )
            .order_by("-first_seen")
            .first()
        )
        # if no group, then redirect to the issues page
        url = issue_list_url
        if group:
            url = reverse("sentry-organization-issue", args=[organization.slug, group.id])
        return HttpResponseRedirect(organization.absolute_url(url))
