import pytz
from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.utils import get_generic_data, get_group_settings_link, get_rules
from sentry.utils import json

from .mail import COMMIT_EXAMPLE, MailPreview, make_generic_event


class DebugGenericIssueEmailView(View):
    def get(self, request):
        org = Organization(id=1, slug="example", name="Example")
        project = Project(id=1, slug="example", name="Example", organization=org)

        event = make_generic_event(project)
        group = event.group

        rule = Rule(id=1, label="An example rule")

        generic_issue_data_html = get_generic_data(event)
        section_header = "Issue Data" if generic_issue_data_html else ""

        return MailPreview(
            html_template="sentry/emails/generic.html",
            text_template="sentry/emails/generic.txt",
            context={
                "rule": rule,
                "rules": get_rules([rule], org, project),
                "group": group,
                "event": event,
                "timezone": pytz.timezone("Europe/Vienna"),
                # http://testserver/organizations/example/issues/<issue-id>/?referrer=alert_email
                #       &alert_type=email&alert_timestamp=<ts>&alert_rule_id=1
                "link": get_group_settings_link(group, None, get_rules([rule], org, project), 1337),
                "generic_issue_data": [(section_header, mark_safe(generic_issue_data_html), None)],
                "tags": event.tags,
                "project_label": project.slug,
                "commits": json.loads(COMMIT_EXAMPLE),
                "issue_title": event.occurrence.issue_title,
                "subtitle": event.occurrence.subtitle,
                "culprit": event.occurrence.culprit,
            },
        ).render(request)
