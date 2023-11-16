from __future__ import annotations

import abc
import itertools
import logging
import time
import traceback
import uuid
from datetime import datetime, timedelta
from hashlib import md5
from random import Random
from typing import Any, Generator
from unittest import mock
from urllib.parse import urlencode

import pytz
from django.http import HttpRequest, HttpResponse
from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.generic import View

from sentry import eventstore
from sentry.constants import LOG_LEVELS
from sentry.digests import Record
from sentry.digests.notifications import Notification, build_digest
from sentry.digests.utils import get_digest_metadata
from sentry.event_manager import EventManager, get_event_type
from sentry.http import get_server_hostname
from sentry.issues.grouptype import NoiseConfig, PerformanceNPlusOneGroupType
from sentry.issues.occurrence_consumer import process_event_and_issue_occurrence
from sentry.mail.notifications import get_builder_args
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.lostpasswordhash import LostPasswordHash
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.models.team import Team
from sentry.notifications.notifications.activity import EMAIL_CLASSES_BY_TYPE
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.digest import DigestNotification
from sentry.notifications.notifications.rules import get_group_substatus_text
from sentry.notifications.types import GroupSubscriptionReason
from sentry.notifications.utils import (
    get_group_settings_link,
    get_interface_list,
    get_issue_replay_link,
    get_rules,
)
from sentry.services.hybrid_cloud.actor import RpcActor
from sentry.testutils.helpers.datetime import before_now  # NOQA:S007
from sentry.testutils.helpers.notifications import (  # NOQA:S007
    SAMPLE_TO_OCCURRENCE_MAP,
    TEST_ISSUE_OCCURRENCE,
)
from sentry.types.group import GroupSubStatus
from sentry.utils import json, loremipsum
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.email import MessageBuilder, inline_css
from sentry.utils.http import absolute_uri
from sentry.utils.samples import load_data
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response, render_to_string

logger = logging.getLogger(__name__)

# TODO(dcramer): change to use serializer
COMMIT_EXAMPLE = """[
{
    "repository": {
        "status": "active",
        "name": "Example Repo",
        "url": "https://github.com/example/example",
        "dateCreated": "2018-02-28T23:39:22.402Z",
        "provider": {"id": "github", "name": "GitHub"},
        "id": "1"
    },
    "score": "2",
    "subject": "feat: Do something to raven/base.py",
    "message": "feat: Do something to raven/base.py\\naptent vivamus vehicula tempus volutpat hac tortor",
    "id": "1b17483ffc4a10609e7921ee21a8567bfe0ed006",
    "shortId": "1b17483",
    "author": {
        "username": "dcramer@gmail.com",
        "isManaged": false,
        "lastActive": "2018-03-01T18:25:28.149Z",
        "id": "1",
        "isActive": true,
        "has2fa": false,
        "name": "dcramer@gmail.com",
        "avatarUrl": "https://secure.gravatar.com/avatar/51567a4f786cd8a2c41c513b592de9f9?s=32&d=mm",
        "dateJoined": "2018-02-27T22:04:32.847Z",
        "emails": [{"is_verified": false, "id": "1", "email": "dcramer@gmail.com"}],
        "avatar": {"avatarUuid": "", "avatarType": "letter_avatar"},
        "lastLogin": "2018-02-27T22:04:32.847Z",
        "email": "dcramer@gmail.com"
    }
}
]"""


def get_random(request) -> Random:
    seed = request.GET.get("seed", str(time.time()))
    return Random(seed)


def make_message(random: Random, length: int | None = None) -> str:
    if length is None:
        length = int(random.weibullvariate(8, 3))
    return " ".join(random.choice(loremipsum.words) for _ in range(length))


def make_culprit(random: Random) -> str:
    def make_module_path_components(min, max):
        for _ in range(random.randint(min, max)):
            yield "".join(
                random.sample(loremipsum.words, random.randint(1, int(random.paretovariate(2.2))))
            )

    return "{module} in {function}".format(
        module=".".join(make_module_path_components(1, 4)), function=random.choice(loremipsum.words)
    )


def make_group_metadata(random: Random) -> dict[str, Any]:
    return {
        "type": "error",
        "metadata": {
            "type": "{}Error".format(
                "".join(
                    word.title() for word in random.sample(loremipsum.words, random.randint(1, 3))
                )
            ),
            "value": make_message(random),
        },
    }


def make_group_generator(random: Random, project: Project) -> Generator[Group, None, None]:
    epoch = int(to_timestamp(datetime(2016, 6, 1, 0, 0, 0, tzinfo=timezone.utc)))
    for id in itertools.count(1):
        first_seen = epoch + random.randint(0, 60 * 60 * 24 * 30)
        last_seen = random.randint(first_seen, first_seen + (60 * 60 * 24 * 30))
        times_seen = 98765

        culprit = make_culprit(random)
        level = random.choice(tuple(LOG_LEVELS))
        message = make_message(random)

        group = Group(
            id=id,
            short_id=id,
            project=project,
            culprit=culprit,
            level=level,
            message=message,
            first_seen=to_datetime(first_seen),
            last_seen=to_datetime(last_seen),
            times_seen=times_seen,
            status=random.choice((GroupStatus.UNRESOLVED, GroupStatus.RESOLVED)),
            data={"type": "default", "metadata": {"title": message}},
        )
        group.has_replays = lambda: random.choice((True, False))  # type: ignore[method-assign]
        if random.random() < 0.8:
            group.data = make_group_metadata(random)

        yield group


def make_error_event(request, project: Project, platform):
    group = next(make_group_generator(get_random(request), project))

    data_dct = dict(load_data(platform))
    data_dct["message"] = group.message
    data_dct.pop("logentry", None)
    data_dct["event_id"] = "44f1419e73884cd2b45c79918f4b6dc4"
    data_dct["environment"] = "prod"
    data_dct["tags"] = [
        ("logger", "javascript"),
        ("environment", "prod"),
        ("level", "error"),
        ("device", "Other"),
    ]
    event_manager = EventManager(data_dct)
    event_manager.normalize()
    data = event_manager.get_data()
    event = event_manager.save(project.id)
    # Prevent CI screenshot from constantly changing
    event.data["timestamp"] = 1504656000.0  # datetime(2017, 9, 6, 0, 0)
    group.message = event.search_message
    event_type = get_event_type(event.data)
    group.data = {"type": event_type.key, "metadata": event_type.get_metadata(data)}
    return event


def make_performance_event(project: Project, sample_name: str):
    timestamp = datetime(2017, 9, 6, 0, 0)
    start_timestamp = timestamp - timedelta(seconds=3)
    event_id = "44f1419e73884cd2b45c79918f4b6dc4"
    occurrence_data = SAMPLE_TO_OCCURRENCE_MAP[sample_name].to_dict()
    occurrence_data["event_id"] = event_id
    perf_data = dict(load_data(sample_name, start_timestamp=start_timestamp, timestamp=timestamp))
    perf_data["event_id"] = event_id
    perf_data["project_id"] = project.id

    with mock.patch.object(
        PerformanceNPlusOneGroupType, "noise_config", new=NoiseConfig(0, timedelta(minutes=1))
    ):
        occurrence, group_info = process_event_and_issue_occurrence(
            occurrence_data,
            perf_data,
        )
    assert group_info is not None
    generic_group = group_info.group
    group_event = generic_group.get_latest_event()
    # Prevent CI screenshot from constantly changing
    assert group_event is not None
    group_event.data["timestamp"] = timestamp.timestamp()
    group_event.data["start_timestamp"] = start_timestamp.timestamp()
    return group_event


def make_generic_event(project: Project):
    event_id = uuid.uuid4().hex
    occurrence_data = TEST_ISSUE_OCCURRENCE.to_dict()
    occurrence_data["event_id"] = event_id
    occurrence_data["fingerprint"] = [
        md5(part.encode("utf-8")).hexdigest() for part in occurrence_data["fingerprint"]
    ]
    occurrence, group_info = process_event_and_issue_occurrence(
        occurrence_data,
        {
            "event_id": event_id,
            "project_id": project.id,
            "timestamp": before_now(minutes=1).isoformat(),
        },
    )
    assert group_info is not None
    generic_group = group_info.group
    return generic_group.get_latest_event()


def get_shared_context(rule, org, project: Project, group, event):
    rules = get_rules([rule], org, project)
    snooze_alert = len(rules) > 0
    snooze_alert_url = rules[0].status_url + urlencode({"mute": "1"}) if snooze_alert else ""
    return {
        "rule": rule,
        "rules": rules,
        "group": group,
        "group_header": get_group_substatus_text(group),
        "event": event,
        "timezone": pytz.timezone("Europe/Vienna"),
        # http://testserver/organizations/example/issues/<issue-id>/?referrer=alert_email
        #       &alert_type=email&alert_timestamp=<ts>&alert_rule_id=1
        "link": get_group_settings_link(group, None, rules, 1337),
        "tags": event.tags,
        "snooze_alert": snooze_alert,
        "snooze_alert_url": absolute_uri(snooze_alert_url),
    }


def add_unsubscribe_link(context):
    if "unsubscribe_link" not in context:
        context[
            "unsubscribe_link"
        ] = 'javascript:alert("This is a preview page, what did you expect to happen?");'


# TODO(dcramer): use https://github.com/disqus/django-mailviews
class MailPreview:
    def __init__(self, html_template, text_template, context=None, subject=None):
        self.html_template = html_template
        self.text_template = text_template
        self.subject = subject
        self.context = context if context is not None else {}
        add_unsubscribe_link(self.context)

    def text_body(self):
        return render_to_string(self.text_template, context=self.context)

    def html_body(self):
        try:
            return inline_css(render_to_string(self.html_template, context=self.context))
        except Exception:
            traceback.print_exc()
            raise

    def render(self, request: HttpRequest):
        return render_to_response(
            "sentry/debug/mail/preview.html",
            context={"preview": self, "format": request.GET.get("format")},
        )


@method_decorator(csrf_exempt, name="dispatch")
class MailPreviewView(View, abc.ABC):
    @abc.abstractmethod
    def get_context(self, request):
        pass

    def get_subject(self, request):
        return None

    @property
    @abc.abstractmethod
    def html_template(self):
        pass

    @property
    @abc.abstractmethod
    def text_template(self):
        pass

    def get(self, request):
        return MailPreview(
            text_template=self.text_template,
            html_template=self.html_template,
            context=self.get_context(request),
            subject=self.get_subject(request),
        ).render(request)

    def post(self, request):
        msg = MessageBuilder(
            subject=self.get_subject(request),
            template=self.text_template,
            html_template=self.html_template,
            type="email.debug",
            context=self.get_context(request),
        )
        msg.send_async(to=["dummy@stuff.com"])

        return redirect(request.path)


class MailPreviewAdapter(MailPreview):
    """
    This is an adapter for MailPreview that will take similar arguments to MessageBuilder
    """

    def __init__(self, **kwargs):
        kwargs["text_template"] = kwargs["template"]
        del kwargs["template"]
        if "from_email" in kwargs:
            del kwargs["from_email"]
        del kwargs["type"]
        super().__init__(**kwargs)


class ActivityMailPreview:
    def __init__(self, request, activity):
        self.request = request
        self.email = EMAIL_CLASSES_BY_TYPE[activity.type](activity)

    def get_context(self):
        context = self.email.get_base_context()
        context["reason"] = get_random(self.request).choice(
            list(GroupSubscriptionReason.descriptions.values())
        )
        context.update(self.email.get_context())
        add_unsubscribe_link(context)
        return context

    def text_body(self):
        txt_template = f"{self.email.template_path}.txt"
        return render_to_string(txt_template, context=self.get_context())

    def html_body(self):
        html_template = f"{self.email.template_path}.html"
        try:
            return inline_css(render_to_string(html_template, context=self.get_context()))
        except Exception:
            import traceback

            traceback.print_exc()
            raise


class ActivityMailDebugView(View):
    def get_activity(self, request: HttpRequest, event):
        raise NotImplementedError

    def get(self, request: HttpRequest) -> HttpResponse:
        org = Organization(id=1, slug="organization", name="My Company")
        project = Project(id=1, organization=org, slug="project", name="My Project")

        group = next(make_group_generator(get_random(request), project))

        data_dct = dict(load_data("python"))
        data_dct["message"] = group.message
        data_dct.pop("logentry", None)

        event_manager = EventManager(data_dct)
        event_manager.normalize()
        data = event_manager.get_data()
        event_type = get_event_type(data)

        event = eventstore.backend.create_event(
            event_id="a" * 32, group_id=group.id, project_id=project.id, data=data.data
        )

        group.message = event.search_message
        group.data = {"type": event_type.key, "metadata": event_type.get_metadata(data)}

        activity = Activity(group=group, project=event.project, **self.get_activity(request, event))

        return render_to_response(
            "sentry/debug/mail/preview.html",
            context={
                "preview": ActivityMailPreview(request, activity),
                "format": request.GET.get("format"),
            },
        )


has_issue_states = True
replay_id = "9188182919744ea987d8e4e58f4a6dec"


@login_required
def alert(request):
    random = get_random(request)
    platform = request.GET.get("platform", "python")
    org = Organization(id=1, slug="example", name="Example")
    project = Project(id=1, slug="example", name="Example", organization=org)

    event = make_error_event(request, project, platform)
    group = event.group

    group.substatus = random.choice(
        [GroupSubStatus.ESCALATING, GroupSubStatus.NEW, GroupSubStatus.REGRESSED]
    )

    rule = Rule(id=1, label="An example rule")
    notification_reason = (
        random.randint(0, 1) > 0
        and f"We notified all members in the {project.get_full_name()} project of this issue"
        or None
    )

    return MailPreview(
        html_template="sentry/emails/error.html",
        text_template="sentry/emails/error.txt",
        context={
            **get_shared_context(rule, org, project, group, event),
            "interfaces": get_interface_list(event),
            "project_label": project.slug,
            "commits": json.loads(COMMIT_EXAMPLE),
            "environment": random.randint(0, 1) > 0 and "prod" or None,
            "notification_reason": notification_reason,
            "notification_settings_link": absolute_uri(
                "/settings/account/notifications/alerts/?referrer=alert_email"
            ),
            "culprit": random.choice(["sentry.tasks.culprit.culprit", None]),
            "subtitle": random.choice(["subtitles are cool", None]),
            "issue_type": group.issue_type.description,
            "has_issue_states": has_issue_states,
            "replay_id": replay_id,
            "issue_replays_url": get_issue_replay_link(group, "?referrer=alert_email"),
        },
    ).render(request)


@login_required
def digest(request):
    random = get_random(request)

    # TODO: Refactor all of these into something more manageable.
    org = Organization(id=1, slug="example", name="Example Organization")
    project = Project(id=1, slug="example", name="Example Project", organization=org)
    rules = {
        i: Rule(id=i, project=project, label=f"Rule #{i}") for i in range(1, random.randint(2, 4))
    }
    state: dict[str, Any] = {
        "project": project,
        "groups": {},
        "rules": rules,
        "event_counts": {},
        "user_counts": {},
    }
    records = []
    group_generator = make_group_generator(random, project)
    notification_uuid = str(uuid.uuid4())
    for _ in range(random.randint(1, 30)):
        group = next(group_generator)
        state["groups"][group.id] = group

        offset = timedelta(seconds=0)
        for _ in range(random.randint(1, 10)):
            offset += timedelta(seconds=random.random() * 120)

            data_dct = dict(load_data("python"))
            data_dct["message"] = group.message
            data_dct.pop("logentry", None)

            event_manager = EventManager(data_dct)
            event_manager.normalize()
            data = event_manager.get_data()

            data["timestamp"] = random.randint(
                int(to_timestamp(group.first_seen)), int(to_timestamp(group.last_seen))
            )

            event = eventstore.backend.create_event(
                event_id=uuid.uuid4().hex, group_id=group.id, project_id=project.id, data=data.data
            )
            records.append(
                Record(
                    event.event_id,
                    Notification(
                        event,
                        random.sample(
                            list(state["rules"].keys()), random.randint(1, len(state["rules"]))
                        ),
                        notification_uuid,
                    ),
                    to_timestamp(event.datetime),
                )
            )

            state["event_counts"][group.id] = random.randint(10, 10000)
            state["user_counts"][group.id] = random.randint(10, 10000)

    # add in performance issues
    for i in range(random.randint(1, 3)):
        perf_event = make_performance_event(project, "transaction-n-plus-one")
        # don't clobber error issue ids
        perf_event.group.id = i + 100
        perf_group = perf_event.group

        records.append(
            Record(
                perf_event.event_id,
                Notification(
                    perf_event,
                    random.sample(
                        list(state["rules"].keys()), random.randint(1, len(state["rules"]))
                    ),
                    notification_uuid,
                ),
                # this is required for acceptance tests to pass as the EventManager won't accept a timestamp in the past
                to_timestamp(datetime(2016, 6, 22, 16, 16, 0, tzinfo=timezone.utc)),
            )
        )
        state["groups"][perf_group.id] = perf_group
        state["event_counts"][perf_group.id] = random.randint(10, 10000)
        state["user_counts"][perf_group.id] = random.randint(10, 10000)

    # add in generic issues
    for i in range(random.randint(1, 3)):
        generic_event = make_generic_event(project)
        generic_group = generic_event.group
        generic_group.id = i + 200  # don't clobber other issue ids

        records.append(
            Record(
                generic_event.event_id,
                Notification(
                    generic_event,
                    random.sample(
                        list(state["rules"].keys()), random.randint(1, len(state["rules"]))
                    ),
                    notification_uuid,
                ),
                # this is required for acceptance tests to pass as the EventManager won't accept a timestamp in the past
                to_timestamp(datetime(2016, 6, 22, 16, 16, 0, tzinfo=timezone.utc)),
            )
        )
        state["groups"][generic_group.id] = generic_group
        state["event_counts"][generic_group.id] = random.randint(10, 10000)
        state["user_counts"][generic_group.id] = random.randint(10, 10000)

    digest, _ = build_digest(project, records, state)
    assert digest is not None
    start, end, counts = get_digest_metadata(digest)

    rule_details = get_rules(list(rules.values()), org, project)
    context = DigestNotification.build_context(digest, project, org, rule_details, 1337)

    context["show_replay_links"] = True
    context["snooze_alert"] = True
    context["snooze_alert_urls"] = {
        rule.id: f"{rule.status_url}?{urlencode({'mute': '1'})}" for rule in rule_details
    }

    add_unsubscribe_link(context)

    return MailPreview(
        html_template="sentry/emails/digests/body.html",
        text_template="sentry/emails/digests/body.txt",
        context=context,
    ).render(request)


@login_required
def request_access(request):
    org = Organization(id=1, slug="sentry", name="Sentry org")
    team = Team(id=1, slug="example", name="Example", organization=org)

    return MailPreview(
        html_template="sentry/emails/request-team-access.html",
        text_template="sentry/emails/request-team-access.txt",
        context={
            "email": "foo@example.com",
            "name": "George Bush",
            "organization": org,
            "team": team,
            "url": org.absolute_url(
                reverse("sentry-organization-teams", kwargs={"organization_slug": org.slug})
            ),
        },
    ).render(request)


@login_required
def request_access_for_another_member(request):
    org = Organization(id=1, slug="sentry", name="Sentry org")
    team = Team(id=1, slug="example", name="Example", organization=org)

    return MailPreview(
        html_template="sentry/emails/request-team-access.html",
        text_template="sentry/emails/request-team-access.txt",
        context={
            "email": "foo@example.com",
            "name": "Username",
            "organization": org,
            "team": team,
            "url": org.absolute_url(
                reverse("sentry-organization-teams", kwargs={"organization_slug": org.slug})
            ),
            "requester": request.user.get_display_name(),
        },
    ).render(request)


@login_required
def invitation(request):
    org = Organization(id=1, slug="example", name="Example")
    om = OrganizationMember(id=1, email="foo@example.com", organization=org)

    return MailPreview(
        html_template="sentry/emails/member-invite.html",
        text_template="sentry/emails/member-invite.txt",
        context={
            "email": "foo@example.com",
            "organization": org,
            "url": absolute_uri(
                reverse(
                    "sentry-accept-invite",
                    kwargs={"member_id": om.id, "token": om.token},
                )
            ),
        },
    ).render(request)


@login_required
def access_approved(request):
    org = Organization(id=1, slug="example", name="Example")
    team = Team(id=1, slug="example", name="Example", organization=org)

    return MailPreview(
        html_template="sentry/emails/access-approved.html",
        text_template="sentry/emails/access-approved.txt",
        context={
            "email": "foo@example.com",
            "name": "George Bush",
            "organization": org,
            "team": team,
        },
    ).render(request)


@login_required
def confirm_email(request):
    email = request.user.emails.first()
    email.set_hash()
    email.save()
    return MailPreview(
        html_template="sentry/emails/confirm_email.html",
        text_template="sentry/emails/confirm_email.txt",
        context={
            "confirm_email": "foo@example.com",
            "user": request.user,
            "url": absolute_uri(
                reverse(
                    "sentry-account-confirm-email", args=[request.user.id, email.validation_hash]
                )
            ),
            "is_new_user": True,
        },
    ).render(request)


@login_required
def recover_account(request):
    return MailPreview(
        html_template="sentry/emails/recover_account.html",
        text_template="sentry/emails/recover_account.txt",
        context={
            "user": request.user,
            "url": absolute_uri(
                reverse(
                    "sentry-account-confirm-email",
                    args=[request.user.id, "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"],
                )
            ),
            "domain": get_server_hostname(),
            "ip_address": request.META["REMOTE_ADDR"],
            "datetime": timezone.now(),
        },
    ).render(request)


@login_required
def relocate_account(request):
    password_hash, __ = LostPasswordHash.objects.get_or_create(user_id=request.user.id)
    return MailPreview(
        html_template="sentry/emails/relocate_account.html",
        text_template="sentry/emails/relocate_account.txt",
        context={
            "user": request.user,
            "url": absolute_uri(
                reverse(
                    "sentry-account-relocate-confirm",
                    args=[request.user.id, password_hash.hash],
                )
            ),
            "domain": get_server_hostname(),
            "ip_address": request.META["REMOTE_ADDR"],
            "datetime": timezone.now(),
            "orgs": ["testsentry", "testgetsentry"],
        },
    ).render(request)


@login_required
def relocation_failed(request):
    return MailPreview(
        html_template="sentry/emails/relocation_failed.html",
        text_template="sentry/emails/relocation_failed.txt",
        context={
            "domain": get_server_hostname(),
            "datetime": timezone.now(),
            "uuid": str(uuid.uuid4().hex),
            "reason": "This is a sample failure reason",
        },
    ).render(request)


@login_required
def relocation_started(request):
    return MailPreview(
        html_template="sentry/emails/relocation_started.html",
        text_template="sentry/emails/relocation_started.txt",
        context={
            "domain": get_server_hostname(),
            "datetime": timezone.now(),
            "uuid": str(uuid.uuid4().hex),
            "orgs": ["testsentry", "testgetsentry"],
        },
    ).render(request)


@login_required
def relocation_succeeded(request):
    return MailPreview(
        html_template="sentry/emails/relocation_succeeded.html",
        text_template="sentry/emails/relocation_succeeded.txt",
        context={
            "domain": get_server_hostname(),
            "datetime": timezone.now(),
            "uuid": str(uuid.uuid4().hex),
            "orgs": ["testsentry", "testgetsentry"],
        },
    ).render(request)


@login_required
def org_delete_confirm(request):
    from sentry.models.auditlogentry import AuditLogEntry

    org = Organization.get_default()
    entry = AuditLogEntry(
        organization_id=org.id, actor=request.user, ip_address=request.META["REMOTE_ADDR"]
    )

    return MailPreview(
        html_template="sentry/emails/org_delete_confirm.html",
        text_template="sentry/emails/org_delete_confirm.txt",
        context={
            "organization": org,
            "audit_log_entry": entry,
            "eta": timezone.now() + timedelta(days=1),
            "url": org.absolute_url(reverse("sentry-restore-organization", args=[org.slug])),
        },
    ).render(request)


# Used to generate debug email views from a notification
def render_preview_email_for_notification(
    notification: BaseNotification, recipient: RpcActor
) -> HttpResponse:
    shared_context = notification.get_context()
    basic_args = get_builder_args(notification, recipient, shared_context)
    # remove unneeded fields
    args = {k: v for k, v in basic_args.items() if k not in ["headers", "reference", "subject"]}
    # convert subject back to a string
    args["subject"] = basic_args["subject"].decode("utf-8")

    preview = MailPreviewAdapter(**args)

    return render_to_response("sentry/debug/mail/preview.html", {"preview": preview})
