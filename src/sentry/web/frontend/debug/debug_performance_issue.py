import pytz
from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.event_manager import EventManager
from sentry.models import Organization, Project, Rule
from sentry.notifications.utils import (
    get_group_settings_link,
    get_interface_list,
    get_rules,
    get_transaction_data,
)
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json
from sentry.utils.samples import load_data

from .mail import MailPreview

COMMIT_EXAMPLE = """[
{
    "repository": {
        "status": "active",
        "name": "Example Repo",
        "url": "https://github.com/example/example",
        "dateCreated": "2022-10-08T23:39:22.402Z",
        "provider": {"id": "github", "name": "GitHub"},
        "id": "1"
    },
    "score": 2,
    "subject": "feat: Make stuff better",
    "message": "feat: Make stuff better aptent vivamus vehicula tempus volutpat hac tortor",
    "id": "1b17483ffc4a10609e7921ee21a8567bfe0ed006",
    "shortId": "1b17483",
    "author": {
        "username": "colleen@sentry.io",
        "isManaged": false,
        "lastActive": "2022-03-01T18:25:28.149Z",
        "id": "1",
        "isActive": true,
        "has2fa": false,
        "name": "colleen@sentry.io",
        "avatarUrl": "https://secure.gravatar.com/avatar/51567a4f786cd8a2c41c513b592de9f9?s=32&d=mm",
        "dateJoined": "2022-10-07T22:04:32.847Z",
        "emails": [{"is_verified": false, "id": "1", "email": "colleen@sentry.io"}],
        "avatar": {"avatarUuid": "", "avatarType": "letter_avatar"},
        "lastLogin": "2022-10-07T22:04:32.847Z",
        "email": "colleen@sentry.io"
    }
}
]"""


class DebugPerformanceIssueEmailView(View):
    @override_options({"performance.issues.all.problem-creation": 1.0})
    @override_options({"performance.issues.all.problem-detection": 1.0})
    @override_options({"performance.issues.n_plus_one_db.problem-creation": 1.0})
    def get(self, request):
        org = Organization(id=1, slug="example", name="Example")
        project = Project(id=1, slug="example", name="Example", organization=org)
        project.update_option("sentry:performance_issue_creation_rate", 1.0)
        with override_options(
            {
                "performance.issues.all.problem-creation": 1.0,
                "performance.issues.all.problem-detection": 1.0,
                "performance.issues.n_plus_one_db.problem-creation": 1.0,
            }
        ):
            perf_data = load_data("transaction-n-plus-one", timestamp=before_now(minutes=10))
            perf_event_manager = EventManager(perf_data)
            perf_event_manager.normalize()
            perf_data = perf_event_manager.get_data()
            perf_event = perf_event_manager.save(project.id)

        perf_event = perf_event.for_group(perf_event.groups[0])
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
            },
        ).render(request)
