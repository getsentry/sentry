from django.http import HttpRequest, HttpResponse
from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.models.project import Project
from sentry.notifications.types import NotificationOrigin
from sentry.notifications.utils import (
    get_interface_list,
    get_performance_issue_alert_subtitle,
    get_transaction_data,
)
from sentry.utils import json
from sentry.web.frontend.base import internal_cell_silo_view

from .mail import COMMIT_EXAMPLE, MailPreview, get_shared_context, make_performance_event


@internal_cell_silo_view
class DebugPerformanceIssueEmailView(View):
    def get(
        self, request: HttpRequest, sample_name: str = "transaction-n-plus-one"
    ) -> HttpResponse:
        project = Project.objects.get(id=1)
        org = project.organization
        perf_event = make_performance_event(project, sample_name)
        if request.GET.get("is_test", False):
            perf_event.group.id = 1
        perf_group = perf_event.group

        origin = NotificationOrigin(
            label="Example performance rule",
            environment_id=None,
            workflow_id=None,
            legacy_rule_id=1,
        )

        transaction_data = get_transaction_data(perf_event)
        interface_list = get_interface_list(perf_event)

        context = {
            **get_shared_context(origin, org, project, perf_group, perf_event),
            "interfaces": interface_list,
            "project_label": project.slug,
            "commits": json.loads(COMMIT_EXAMPLE),
            "transaction_data": [("Span Evidence", mark_safe(transaction_data), None)],
            "issue_type": perf_group.issue_type.description,
            "subtitle": get_performance_issue_alert_subtitle(perf_event),
        }

        if perf_event.occurrence is not None:
            context.update({"issue_title": perf_event.occurrence.issue_title})

        return MailPreview(
            html_template="sentry/emails/performance.html",
            text_template="sentry/emails/performance.txt",
            context=context,
        ).render(request)
