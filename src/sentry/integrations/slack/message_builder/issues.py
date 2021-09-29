import re
from typing import Any, List, Mapping, Optional, Sequence, Set, Tuple, Union

from django.core.cache import cache

from sentry import tagstore
from sentry.eventstore.models import Event
from sentry.integrations.slack.message_builder import LEVEL_TO_COLOR, SlackBody
from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.models import (
    ActorTuple,
    Group,
    GroupAssignee,
    GroupStatus,
    Identity,
    OrganizationMember,
    Project,
    ReleaseProject,
    Rule,
    Team,
    User,
)
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.utils import json
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri

from ..utils import build_notification_footer


def format_actor_option(actor: Union["Team", "User"]) -> Mapping[str, str]:
    if isinstance(actor, User):
        return {"text": actor.get_display_name(), "value": f"user:{actor.id}"}
    if isinstance(actor, Team):
        return {"text": f"#{actor.slug}", "value": f"team:{actor.id}"}

    raise NotImplementedError


def get_member_assignees(group: Group) -> Sequence[Mapping[str, str]]:
    queryset = (
        OrganizationMember.objects.filter(
            user__is_active=True,
            organization=group.organization,
            teams__in=group.project.teams.all(),
        )
        .distinct()
        .select_related("user")
    )

    members = sorted(queryset, key=lambda u: u.user.get_display_name())  # type: ignore

    return [format_actor_option(u.user) for u in members]


def get_team_assignees(group: Group) -> Sequence[Mapping[str, str]]:
    return [format_actor_option(u) for u in group.project.teams.all()]


def get_assignee(group: Group) -> Optional[Mapping[str, str]]:
    try:
        assigned_actor = GroupAssignee.objects.get(group=group).assigned_actor()
    except GroupAssignee.DoesNotExist:
        return None

    try:
        return format_actor_option(assigned_actor.resolve())
    except assigned_actor.type.DoesNotExist:
        return None


def build_attachment_title(obj: Union[Group, Event]) -> str:
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()

    if ev_type == "error" and "type" in ev_metadata:
        title = ev_metadata["type"]

    elif ev_type == "csp":
        title = f'{ev_metadata["directive"]} - {ev_metadata["uri"]}'

    else:
        title = obj.title

    # Explicitly typing to satisfy mypy.
    title_str: str = title
    return title_str


def build_attachment_text(group: Group, event: Optional[Event] = None) -> Optional[Any]:
    # Group and Event both implement get_event_{type,metadata}
    obj = event if event is not None else group
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()

    if ev_type == "error":
        return ev_metadata.get("value") or ev_metadata.get("function")
    else:
        return None


def build_assigned_text(identity: Identity, assignee: str) -> Optional[str]:
    actor = ActorTuple.from_actor_identifier(assignee)

    try:
        assigned_actor = actor.resolve()
    except actor.type.DoesNotExist:
        return None

    if actor.type == Team:
        assignee_text = f"#{assigned_actor.slug}"
    elif actor.type == User:
        try:
            assignee_ident = Identity.objects.get(
                user=assigned_actor, idp__type="slack", idp__external_id=identity.idp.external_id
            )
            assignee_text = f"<@{assignee_ident.external_id}>"
        except Identity.DoesNotExist:
            assignee_text = assigned_actor.get_display_name()
    else:
        raise NotImplementedError

    return f"*Issue assigned to {assignee_text} by <@{identity.external_id}>*"


def build_action_text(group: Group, identity: Identity, action: Mapping[str, Any]) -> Optional[str]:
    if action["name"] == "assign":
        return build_assigned_text(identity, action["selected_options"][0]["value"])

    statuses = {"resolved": "resolved", "ignored": "ignored", "unresolved": "re-opened"}

    # Resolve actions have additional 'parameters' after ':'
    status = action["value"].split(":", 1)[0]

    # Action has no valid action text, ignore
    if status not in statuses:
        return None

    return "*Issue {status} by <@{user_id}>*".format(
        status=statuses[status], user_id=identity.external_id
    )


def build_rule_url(rule: Any, group: Group, project: Project) -> str:
    org_slug = group.organization.slug
    project_slug = project.slug
    rule_url = f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule.id}/"

    # Explicitly typing to satisfy mypy.
    url: str = absolute_uri(rule_url)
    return url


def build_footer(group: Group, project: Project, rules: Optional[Sequence[Rule]] = None) -> str:
    footer = f"{group.qualified_short_id}"
    if rules:
        rule_url = build_rule_url(rules[0], group, project)
        footer += f" via <{rule_url}|{rules[0].label}>"

        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer


def build_tag_fields(
    event_for_tags: Any, tags: Optional[Set[str]] = None
) -> Sequence[Mapping[str, Union[str, bool]]]:
    fields = []
    if tags:
        event_tags = event_for_tags.tags if event_for_tags else []
        for key, value in event_tags:
            std_key = tagstore.get_standardized_key(key)
            if std_key not in tags:
                continue

            labeled_value = tagstore.get_tag_value_label(key, value)
            fields.append(
                {
                    "title": std_key.encode("utf-8"),
                    "value": labeled_value.encode("utf-8"),
                    "short": True,
                }
            )
    return fields


def build_actions(
    group: Group,
    project: Project,
    text: str,
    color: str,
    actions: Optional[Sequence[Any]] = None,
    identity: Optional[Identity] = None,
) -> Tuple[Sequence[Any], str, str]:
    """
    Having actions means a button will be shown on the Slack message e.g. ignore, resolve, assign
    """
    status = group.get_status()
    members = get_member_assignees(group)
    teams = get_team_assignees(group)

    if actions is None:
        actions = []

    assignee = get_assignee(group)

    resolve_button = {
        "name": "resolve_dialog",
        "value": "resolve_dialog",
        "type": "button",
        "text": "Resolve...",
    }

    ignore_button = {"name": "status", "value": "ignored", "type": "button", "text": "Ignore"}

    cache_key = f"has_releases:2:{project.id}"
    has_releases = cache.get(cache_key)
    if has_releases is None:
        has_releases = ReleaseProject.objects.filter(project_id=project.id).exists()
        if has_releases:
            cache.set(cache_key, True, 3600)
        else:
            cache.set(cache_key, False, 60)

    if not has_releases:
        resolve_button.update({"name": "status", "text": "Resolve", "value": "resolved"})

    if status == GroupStatus.RESOLVED:
        resolve_button.update({"name": "status", "text": "Unresolve", "value": "unresolved"})

    if status == GroupStatus.IGNORED:
        ignore_button.update({"text": "Stop Ignoring", "value": "unresolved"})

    option_groups = []

    if teams:
        option_groups.append({"text": "Teams", "options": teams})

    if members:
        option_groups.append({"text": "People", "options": members})

    payload_actions = [
        resolve_button,
        ignore_button,
        {
            "name": "assign",
            "text": "Select Assignee...",
            "type": "select",
            "selected_options": [assignee],
            "option_groups": option_groups,
        },
    ]

    if actions:
        action_texts = [_f for _f in [build_action_text(group, identity, a) for a in actions] if _f]
        text += "\n" + "\n".join(action_texts)

        color = "_actioned_issue"
        payload_actions = []

    return payload_actions, text, color


def get_title_link(
    group: Group,
    event: Optional[Event],
    link_to_event: bool,
    issue_details: bool,
    notification: Optional[BaseNotification],
) -> str:
    if event and link_to_event:
        url = group.get_absolute_url(params={"referrer": "slack"}, event_id=event.event_id)

    elif issue_details:
        referrer = re.sub("Notification$", "Slack", notification.__class__.__name__)
        url = group.get_absolute_url(params={"referrer": referrer})

    else:
        url = group.get_absolute_url(params={"referrer": "slack"})

    # Explicitly typing to satisfy mypy.
    url_str: str = url
    return url_str


def get_timestamp(group: Group, event: Optional[Event]) -> float:
    ts = group.last_seen
    return to_timestamp(max(ts, event.datetime) if event else ts)


def get_color(event_for_tags: Optional[Event], notification: Optional[BaseNotification]) -> str:
    if notification:
        if not isinstance(notification, AlertRuleNotification):
            return "info"
    if event_for_tags:
        color: Optional[str] = event_for_tags.get_tag("level")
        if color and color in LEVEL_TO_COLOR.keys():
            return color
    return "error"


class SlackIssuesMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        group: Group,
        event: Optional[Event] = None,
        tags: Optional[Set[str]] = None,
        identity: Optional[Identity] = None,
        actions: Optional[Sequence[Any]] = None,
        rules: Optional[List[Rule]] = None,
        link_to_event: bool = False,
        issue_details: bool = False,
        notification: Optional[BaseNotification] = None,
        recipient: Optional[Union["Team", "User"]] = None,
    ) -> None:
        super().__init__()
        self.group = group
        self.event = event
        self.tags = tags
        self.identity = identity
        self.actions = actions
        self.rules = rules
        self.link_to_event = link_to_event
        self.issue_details = issue_details
        self.notification = notification
        self.recipient = recipient

    def build(self) -> SlackBody:
        # XXX(dcramer): options are limited to 100 choices, even when nested
        text = build_attachment_text(self.group, self.event) or ""
        project = Project.objects.get_from_cache(id=self.group.project_id)

        # If an event is unspecified, use the tags of the latest event (if one exists).
        event_for_tags = self.event or self.group.get_latest_event()
        color = get_color(event_for_tags, self.notification)
        fields = build_tag_fields(event_for_tags, self.tags)
        footer = (
            build_notification_footer(self.notification, self.recipient)
            if self.notification and self.recipient
            else build_footer(self.group, project, self.rules)
        )
        obj = self.event if self.event is not None else self.group
        if not self.issue_details or (self.recipient and isinstance(self.recipient, Team)):
            payload_actions, text, color = build_actions(
                self.group, project, text, color, self.actions, self.identity
            )
        else:
            payload_actions = []
        return self._build(
            actions=payload_actions,
            callback_id=json.dumps({"issue": self.group.id}),
            color=color,
            fallback=f"[{project.slug}] {obj.title}",
            fields=fields,
            footer=footer,
            text=text,
            title=build_attachment_title(obj),
            title_link=get_title_link(
                self.group, self.event, self.link_to_event, self.issue_details, self.notification
            ),
            ts=get_timestamp(self.group, self.event) if not self.issue_details else None,
        )


def build_group_attachment(
    group: Group,
    event: Optional[Event] = None,
    tags: Optional[Set[str]] = None,
    identity: Optional[Identity] = None,
    actions: Optional[Sequence[Any]] = None,
    rules: Optional[List[Rule]] = None,
    link_to_event: bool = False,
    issue_details: bool = False,
) -> SlackBody:
    """@deprecated"""
    return SlackIssuesMessageBuilder(
        group, event, tags, identity, actions, rules, link_to_event, issue_details
    ).build()
