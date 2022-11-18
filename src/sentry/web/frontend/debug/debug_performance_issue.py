from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.models import Project, Rule
from sentry.notifications.utils import (
    get_interface_list,
    get_performance_issue_alert_subtitle,
    get_transaction_data,
)
from sentry.types.issues import GROUP_TYPE_TO_TEXT
from sentry.utils import json

from .mail import COMMIT_EXAMPLE, MailPreview, get_shared_context, make_performance_event


class DebugPerformanceIssueEmailView(View):
    def get(self, request):
        project = Project.objects.first()
        org = project.organization
        project.update_option("sentry:performance_issue_creation_rate", 1.0)
        perf_event = make_performance_event(project)
        perf_event.group.id = 1  # hard code to 1 for acceptance tests. comment this line out for debug view. yeah, it's stupid.
        perf_group = perf_event.group

        rule = Rule(id=1, label="Example performance rule")

        transaction_data = get_transaction_data(perf_event)
        interface_list = get_interface_list(perf_event)

        return MailPreview(
            html_template="sentry/emails/performance.html",
            text_template="sentry/emails/performance.txt",
            context={
                **get_shared_context(rule, org, project, perf_group, perf_event),
                "interfaces": interface_list,
                "project_label": project.slug,
                "commits": json.loads(COMMIT_EXAMPLE),
                "transaction_data": [("Span Evidence", mark_safe(transaction_data), None)],
                "issue_type": GROUP_TYPE_TO_TEXT.get(perf_group.issue_type, "Issue"),
                "subtitle": get_performance_issue_alert_subtitle(perf_event),
            },
        ).render(request)
