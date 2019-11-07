from __future__ import absolute_import

import logging

from django.core.cache import cache
from django.core.urlresolvers import reverse

from sentry import http
from sentry import tagstore
from sentry.api.fields.actor import Actor
from sentry.incidents.logic import get_incident_aggregates
from sentry.incidents.models import IncidentStatus
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri
from sentry.models import (
    GroupStatus,
    GroupAssignee,
    OrganizationMember,
    Project,
    User,
    Identity,
    Integration,
    Team,
    ReleaseProject,
)

logger = logging.getLogger("sentry.integrations.slack")

# Attachment colors used for issues with no actions take
ACTIONED_ISSUE_COLOR = "#EDEEEF"
RESOLVED_COLOR = "#0cbd4d"
LEVEL_TO_COLOR = {
    "debug": "#fbe14f",
    "info": "#2788ce",
    "warning": "#f18500",
    "error": "#E03E2F",
    "fatal": "#d20f2a",
}
MEMBER_PREFIX = "@"
CHANNEL_PREFIX = "#"
strip_channel_chars = "".join([MEMBER_PREFIX, CHANNEL_PREFIX])


def format_actor_option(actor):
    if isinstance(actor, User):
        return {"text": actor.get_display_name(), "value": u"user:{}".format(actor.id)}
    if isinstance(actor, Team):
        return {"text": u"#{}".format(actor.slug), "value": u"team:{}".format(actor.id)}

    raise NotImplementedError


def get_member_assignees(group):
    queryset = (
        OrganizationMember.objects.filter(
            user__is_active=True,
            organization=group.organization,
            teams__in=group.project.teams.all(),
        )
        .distinct()
        .select_related("user")
    )

    members = sorted(queryset, key=lambda u: u.user.get_display_name())

    return [format_actor_option(u.user) for u in members]


def get_team_assignees(group):
    return [format_actor_option(u) for u in group.project.teams.all()]


def get_assignee(group):
    try:
        assigned_actor = GroupAssignee.objects.get(group=group).assigned_actor()
    except GroupAssignee.DoesNotExist:
        return None

    try:
        return format_actor_option(assigned_actor.resolve())
    except assigned_actor.type.DoesNotExist:
        return None


def build_attachment_title(obj):
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()

    if ev_type == "error" and "type" in ev_metadata:
        return ev_metadata["type"]
    elif ev_type == "csp":
        return u"{} - {}".format(ev_metadata["directive"], ev_metadata["uri"])
    else:
        return obj.title


def build_attachment_text(group, event=None):
    # Group and Event both implement get_event_{type,metadata}
    obj = event if event is not None else group
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()

    if ev_type == "error":
        return ev_metadata.get("value") or ev_metadata.get("function")
    else:
        return None


def build_assigned_text(group, identity, assignee):
    actor = Actor.from_actor_id(assignee)

    try:
        assigned_actor = actor.resolve()
    except actor.type.DoesNotExist:
        return

    if actor.type == Team:
        assignee_text = u"#{}".format(assigned_actor.slug)
    elif actor.type == User:
        try:
            assignee_ident = Identity.objects.get(
                user=assigned_actor, idp__type="slack", idp__external_id=identity.idp.external_id
            )
            assignee_text = u"<@{}>".format(assignee_ident.external_id)
        except Identity.DoesNotExist:
            assignee_text = assigned_actor.get_display_name()
    else:
        raise NotImplementedError

    return u"*Issue assigned to {assignee_text} by <@{user_id}>*".format(
        assignee_text=assignee_text, user_id=identity.external_id
    )


def build_action_text(group, identity, action):
    if action["name"] == "assign":
        return build_assigned_text(group, identity, action["selected_options"][0]["value"])

    statuses = {"resolved": "resolved", "ignored": "ignored", "unresolved": "re-opened"}

    # Resolve actions have additional 'parameters' after ':'
    status = action["value"].split(":", 1)[0]

    # Action has no valid action text, ignore
    if status not in statuses:
        return

    return u"*Issue {status} by <@{user_id}>*".format(
        status=statuses[status], user_id=identity.external_id
    )


def build_group_attachment(group, event=None, tags=None, identity=None, actions=None, rules=None):
    # XXX(dcramer): options are limited to 100 choices, even when nested
    status = group.get_status()

    members = get_member_assignees(group)
    teams = get_team_assignees(group)

    logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
    color = (
        LEVEL_TO_COLOR.get(event.get_tag("level"), "error") if event else LEVEL_TO_COLOR["error"]
    )

    text = build_attachment_text(group, event) or ""

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

    project = Project.objects.get_from_cache(id=group.project_id)

    cache_key = "has_releases:2:%s" % (project.id)
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

    fields = []

    if tags:
        event_tags = event.tags if event else group.get_latest_event().tags

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

    if actions:
        action_texts = filter(None, [build_action_text(group, identity, a) for a in actions])
        text += "\n" + "\n".join(action_texts)

        color = ACTIONED_ISSUE_COLOR
        payload_actions = []

    ts = group.last_seen

    if event:
        event_ts = event.datetime
        ts = max(ts, event_ts)

    footer = u"{}".format(group.qualified_short_id)

    if rules:
        footer += u" via {}".format(rules[0].label)

        if len(rules) > 1:
            footer += u" (+{} other)".format(len(rules) - 1)

    obj = event if event is not None else group
    return {
        "fallback": u"[{}] {}".format(project.slug, obj.title),
        "title": build_attachment_title(obj),
        "title_link": group.get_absolute_url(params={"referrer": "slack"}),
        "text": text,
        "fields": fields,
        "mrkdwn_in": ["text"],
        "callback_id": json.dumps({"issue": group.id}),
        "footer_icon": logo_url,
        "footer": footer,
        "ts": to_timestamp(ts),
        "color": color,
        "actions": payload_actions,
    }


def build_incident_attachment(incident):
    logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))

    aggregates = get_incident_aggregates(incident)

    if incident.status == IncidentStatus.CLOSED.value:
        status = "Resolved"
        color = RESOLVED_COLOR
    else:
        status = "Fired"
        color = LEVEL_TO_COLOR["error"]

    fields = [
        {"title": "Status", "value": status, "short": True},
        {"title": "Events", "value": aggregates["count"], "short": True},
        {"title": "Users", "value": aggregates["unique_users"], "short": True},
    ]

    ts = incident.date_started

    title = u"INCIDENT: {} (#{})".format(incident.title, incident.identifier)

    return {
        "fallback": title,
        "title": title,
        "title_link": absolute_uri(
            reverse(
                "sentry-incident",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_id": incident.identifier,
                },
            )
        ),
        "text": " ",
        "fields": fields,
        "mrkdwn_in": ["text"],
        "footer_icon": logo_url,
        "footer": "Sentry Incident",
        "ts": to_timestamp(ts),
        "color": color,
        "actions": [],
    }


# Different list types in slack that we'll use to resolve a channel name. Format is
# (<list_name>, <result_name>, <prefix>).
LIST_TYPES = [
    ("channels", "channels", CHANNEL_PREFIX),
    ("groups", "groups", CHANNEL_PREFIX),
    ("users", "members", MEMBER_PREFIX),
]


def get_channel_id(organization, integration_id, name):
    """
    Fetches the internal slack id of a channel.
    :param organization: The organization that is using this integration
    :param integration_id: The integration id of this slack integration
    :param name: The name of the channel
    :return:
    """
    name = name.lstrip(strip_channel_chars)
    try:
        integration = Integration.objects.get(
            provider="slack", organizations=organization, id=integration_id
        )
    except Integration.DoesNotExist:
        return None

    token_payload = {"token": integration.metadata["access_token"]}

    # Look for channel ID
    payload = dict(token_payload, **{"exclude_archived": False, "exclude_members": True})

    session = http.build_session()
    for list_type, result_name, prefix in LIST_TYPES:
        # Slack limits the response of `<list_type>.list` to 1000 channels, paginate if
        # needed
        cursor = ""
        while cursor is not None:
            items = session.get(
                "https://slack.com/api/%s.list" % list_type,
                params=dict(payload, **{"cursor": cursor}),
            )
            items = items.json()
            if not items.get("ok"):
                logger.info(
                    "rule.slack.%s_list_failed" % list_type, extra={"error": items.get("error")}
                )
                return None

            cursor = items.get("response_metadata", {}).get("next_cursor", None)
            item_id = {c["name"]: c["id"] for c in items[result_name]}.get(name)
            if item_id:
                return prefix, item_id


def send_incident_alert_notification(integration, incident, channel):
    attachment = build_incident_attachment(incident)

    payload = {
        "token": integration.metadata["access_token"],
        "channel": channel,
        "attachments": json.dumps([attachment]),
    }

    session = http.build_session()
    resp = session.post("https://slack.com/api/chat.postMessage", data=payload, timeout=5)
    resp.raise_for_status()
    resp = resp.json()
    if not resp.get("ok"):
        logger.info("rule.fail.slack_post", extra={"error": resp.get("error")})
