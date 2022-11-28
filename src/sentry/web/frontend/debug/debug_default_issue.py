import pytz
from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.models import Organization, Project, Rule
from sentry.notifications.utils import get_default_data, get_group_settings_link, get_rules
from sentry.types.issues import GROUP_TYPE_TO_TEXT
from sentry.utils import json

from .mail import COMMIT_EXAMPLE, MailPreview, make_event


class DebugDefaultIssueEmailView(View):
    def get(self, request):
        platform = request.GET.get("platform", "python")
        org = Organization(id=1, slug="example", name="Example")
        project = Project(id=1, slug="example", name="Example", organization=org)

        event = make_event(request, project, platform)
        group = event.group

        rule = Rule(id=1, label="An example rule")

        default_issue_data_html = get_default_data(event)

        return MailPreview(
            html_template="sentry/emails/default.html",
            text_template="sentry/emails/default.txt",
            context={
                "rule": rule,
                "rules": get_rules([rule], org, project),
                "group": group,
                "event": event,
                "timezone": pytz.timezone("Europe/Vienna"),
                # http://testserver/organizations/example/issues/<issue-id>/?referrer=alert_email
                #       &alert_type=email&alert_timestamp=<ts>&alert_rule_id=1
                "link": get_group_settings_link(group, None, get_rules([rule], org, project), 1337),
                "default_issue_data": [("Issue Data", mark_safe(default_issue_data_html), None)],
                "tags": event.tags,
                "project_label": project.slug,
                "commits": json.loads(COMMIT_EXAMPLE),
                "issue_type": GROUP_TYPE_TO_TEXT.get(group.issue_type, "Issue"),
                "subtitle": event.title,
            },
        ).render(request)
