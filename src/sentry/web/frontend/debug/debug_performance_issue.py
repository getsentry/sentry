import pytz
from django.utils.safestring import mark_safe
from django.views.generic import View

from fixtures.github import COMMIT_EXAMPLE
from sentry.event_manager import EventManager, get_event_type
from sentry.models import Organization, Project, Rule
from sentry.notifications.utils import get_group_settings_link, get_rules
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json
from sentry.utils.samples import load_data

from .mail import MailPreview, get_random, make_group_generator


class DebugPerformanceIssueEmailView(View):
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
            html_template="sentry/emails/error.html",
            text_template="sentry/emails/error.txt",
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
            },
        ).render(request)
