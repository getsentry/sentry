from django.conf import settings
from django.http import HttpRequest, HttpResponse
from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.types import NotificationOrigin
from sentry.notifications.utils import get_generic_data
from sentry.notifications.utils.links import get_group_settings_link, get_rules
from sentry.utils import json
from sentry.web.frontend.base import internal_cell_silo_view

from .mail import COMMIT_EXAMPLE, MailPreview, make_feedback_issue


@internal_cell_silo_view
class DebugFeedbackIssueEmailView(View):
    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(id=1, slug="example", name="Example")
        project = Project(id=1, slug="example", name="Example", organization=org)

        event = make_feedback_issue(project)
        assert event.occurrence is not None
        group = event.group

        origin = NotificationOrigin(
            label="An example rule",
            environment_id=None,
            workflow_id=None,
            legacy_rule_id=1,
        )
        rules = get_rules([origin], org, project, group.type)

        generic_issue_data_html = get_generic_data(event)
        section_header = "Issue Data" if generic_issue_data_html else ""
        return MailPreview(
            html_template="sentry/emails/feedback.html",
            text_template="sentry/emails/feedback.txt",
            context={
                "rule": rules[0],
                "rules": rules,
                "group": group,
                "event": event,
                "timezone": settings.SENTRY_DEFAULT_TIME_ZONE,
                "link": get_group_settings_link(
                    group,
                    None,
                    rules,
                ),
                "generic_issue_data": [(section_header, mark_safe(generic_issue_data_html), None)],
                "tags": event.tags,
                "project_label": project.slug,
                "commits": json.loads(COMMIT_EXAMPLE),
                "issue_title": event.occurrence.issue_title,
                "subtitle": event.occurrence.subtitle,
                "culprit": event.occurrence.culprit,
            },
        ).render(request)
