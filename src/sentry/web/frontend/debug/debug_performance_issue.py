import pytz
from django.utils.safestring import mark_safe
from django.views.generic import View

from sentry.api.serializers.models.event import get_entries
from sentry.event_manager import EventManager, get_event_type
from sentry.models import Organization, Project, Rule
from sentry.notifications.utils import get_group_settings_link, get_rules
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json
from sentry.utils.samples import load_data
from sentry.web.helpers import render_to_string

from .mail import MailPreview, get_random, make_group_generator

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
    def perf_to_email_html(self, transaction_data, **kwargs):
        # change all the context
        context = {
            # "user_id": self.id,
            # "user_email": self.email,
            # "user_username": self.username,
            # "user_ip_address": self.ip_address,
            # "user_data": self.data,
            # "user": self,
            "transaction_name": transaction_data.get("description"),
            "parent_span": "idk",
            "preceding_span": "idk",
            "repeating spans": "idk",
            "num_repeating_spans": "idk4",
        }
        # make a new html file for this I guess, idk if it should live in the same path though
        return render_to_string("sentry/partial/interfaces/user_email.html", context)

    def get(self, request):
        org = Organization(id=1, slug="example", name="Example")
        project = Project(id=1, slug="example", name="Example", organization=org)
        random = get_random(request)

        perf_group = next(make_group_generator(random, project))
        perf_data = load_data("transaction", timestamp=before_now(minutes=10))
        perf_event_manager = EventManager(perf_data)
        perf_event_manager.normalize()
        perf_data = perf_event_manager.get_data()
        perf_event = perf_event_manager.save(project.id)
        perf_event.data["timestamp"] = 1504656000.0  # datetime(2017, 9, 6, 0, 0)
        perf_event_type = get_event_type(perf_event.data)
        perf_group.message = perf_event.search_message
        perf_group.data = {
            "type": perf_event_type.key,
            "metadata": perf_event_type.get_metadata(perf_data),
        }

        rule = Rule(id=1, label="Example performance rule")

        entries = get_entries(perf_event, None)
        transaction_data = {}
        if len(entries):
            transaction_data = [entry.get("data") for entry in entries[0] if entry.get("type") == "spans"][0]

        # print("transaction name: ", transaction_data[0].get("description"))

        # XXX: this interface_list code needs to be the same as in
        #      src/sentry/mail/adapter.py
        interface_list = []
        for interface in perf_event.interfaces.values():
            body = interface.to_email_html(perf_event)
            if not body:
                continue
            text_body = interface.to_string(perf_event)
            interface_list.append((interface.get_title(), mark_safe(body), text_body))

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
                # "transaction_data": idk_yet
            },
        ).render(request)
