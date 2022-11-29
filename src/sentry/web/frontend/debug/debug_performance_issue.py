import datetime

import pytz
from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.event_manager import EventManager
from sentry.models import Project, Rule
from sentry.notifications.utils import (
    get_group_settings_link,
    get_interface_list,
    get_performance_issue_alert_subtitle,
    get_rules,
    get_transaction_data,
)
from sentry.testutils.helpers import override_options
from sentry.types.issues import GROUP_TYPE_TO_TEXT
from sentry.utils import json
from sentry.utils.samples import load_data

from .mail import COMMIT_EXAMPLE, MailPreview


class DebugPerformanceIssueEmailView(View):
    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def get(self, request):
        project = Project.objects.first()
        org = project.organization
        project.update_option("sentry:performance_issue_creation_rate", 1.0)
        with override_options(
            {
                "performance.issues.all.problem-creation": 1.0,
                "performance.issues.all.problem-detection": 1.0,
                "performance.issues.n_plus_one_db.problem-creation": 1.0,
            }
        ):
            # make this consistent for acceptance tests
            perf_data = dict(
                load_data(
                    "transaction-n-plus-one",
                    timestamp=datetime.datetime(2022, 11, 11, 21, 39, 23, 30723),
                )
            )
            perf_data["event_id"] = "44f1419e73884cd2b45c79918f4b6dc4"
            perf_event_manager = EventManager(perf_data)
            perf_event_manager.normalize()
            perf_data = perf_event_manager.get_data()
            perf_event = perf_event_manager.save(project.id)

        perf_event = perf_event.for_group(perf_event.groups[0])
        perf_event.group.id = 1  # hard code to 1 for acceptance tests
        perf_group = perf_event.group

        rule = Rule(id=1, label="Example performance rule")

        transaction_data = get_transaction_data(perf_event)
        interface_list = get_interface_list(perf_event)

        return MailPreview(
            html_template="sentry/emails/performance.html",
            text_template="sentry/emails/performance.txt",
            context={
                "rule": rule,
                "rules": get_rules([rule], org, project),
                "group": perf_group,
                "event": perf_event,
                "timezone": pytz.timezone("Europe/Vienna"),
                # http://testserver/organizations/example/issues/<issue-id>/?referrer=alert_email
                #       &alert_type=email&alert_timestamp=<ts>&alert_rule_id=1
                "link": get_group_settings_link(
                    perf_group, None, get_rules([rule], org, project), 1337
                ),
                "interfaces": interface_list,
                "tags": perf_event.tags,
                "project_label": project.slug,
                "commits": json.loads(COMMIT_EXAMPLE),
                "transaction_data": [("Span Evidence", mark_safe(transaction_data), None)],
                "issue_type": GROUP_TYPE_TO_TEXT.get(perf_group.issue_type, "Issue"),
                "subtitle": get_performance_issue_alert_subtitle(perf_event),
            },
        ).render(request)
