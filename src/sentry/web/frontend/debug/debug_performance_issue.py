from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.models import Project, Rule
from sentry.notifications.utils import (
    get_interface_list,
    get_performance_issue_alert_subtitle,
    get_transaction_data,
)
from sentry.utils import json

from .mail import COMMIT_EXAMPLE, MailPreview, get_shared_context, make_performance_event


class DebugPerformanceIssueEmailView(View):
    def get(self, request, sample_name="transaction-n-plus-one"):
        project = Project.objects.first()
        org = project.organization
        perf_event = make_performance_event(project, sample_name)
        if request.GET.get("is_test", False):
            perf_event.group.id = 1
        perf_group = perf_event.group

        rule = Rule(id=1, label="Example performance rule")

        transaction_data = get_transaction_data(perf_event)
        interface_list = get_interface_list(perf_event)

        context = {
            **get_shared_context(rule, org, project, perf_group, perf_event),
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
