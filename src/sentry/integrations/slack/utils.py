from __future__ import absolute_import

import logging
import time
import six
from datetime import timedelta

from django.core.cache import cache
from django.core.urlresolvers import reverse

from sentry import tagstore
from sentry.api.fields.actor import Actor
from sentry.incidents.logic import get_incident_aggregates
from sentry.incidents.models import IncidentStatus, IncidentTrigger
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

from sentry.shared_integrations.exceptions import ApiError
from .client import SlackClient

logger = logging.getLogger("sentry.integrations.slack")

# Attachment colors used for issues with no actions take
ACTIONED_ISSUE_COLOR = "#EDEEEF"
RESOLVED_COLOR = "#4dc771"
LEVEL_TO_COLOR = {
    "debug": "#fbe14f",
    "info": "#2788ce",
    "warning": "#FFC227",
    "error": "#E03E2F",
    "fatal": "#FA4747",
}
MEMBER_PREFIX = "@"
CHANNEL_PREFIX = "#"
strip_channel_chars = "".join([MEMBER_PREFIX, CHANNEL_PREFIX])
SLACK_DEFAULT_TIMEOUT = 10
QUERY_AGGREGATION_DISPLAY = {
    "count()": "events",
    "count_unique(tags[sentry:user])": "users affected",
}


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
    actor = Actor.from_actor_identifier(assignee)

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
        action_texts = [_f for _f in [build_action_text(group, identity, a) for a in actions] if _f]
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
    alert_rule = incident.alert_rule

    incident_trigger = (
        IncidentTrigger.objects.filter(incident=incident).order_by("-date_modified").first()
    )
    if incident_trigger:
        alert_rule_trigger = incident_trigger.alert_rule_trigger
        # TODO: If we're relying on this and expecting possible delays between a trigger fired and this function running,
        # then this could actually be incorrect if they changed the trigger's time window in this time period. Should we store it?
        start = incident_trigger.date_modified - timedelta(
            seconds=alert_rule_trigger.alert_rule.snuba_query.time_window
        )
        end = incident_trigger.date_modified
    else:
        start, end = None, None

    if incident.status == IncidentStatus.CLOSED.value:
        status = "Resolved"
        color = RESOLVED_COLOR
    elif incident.status == IncidentStatus.WARNING.value:
        status = "Warning"
        color = LEVEL_TO_COLOR["warning"]
    elif incident.status == IncidentStatus.CRITICAL.value:
        status = "Critical"
        color = LEVEL_TO_COLOR["fatal"]

    agg_text = QUERY_AGGREGATION_DISPLAY.get(
        alert_rule.snuba_query.aggregate, alert_rule.snuba_query.aggregate
    )
    agg_value = get_incident_aggregates(incident, start, end, use_alert_aggregate=True)["count"]
    time_window = alert_rule.snuba_query.time_window / 60

    text = "{} {} in the last {} minutes".format(agg_value, agg_text, time_window)

    if alert_rule.snuba_query.query != "":
        text = text + "\nFilter: {}".format(alert_rule.snuba_query.query)

    ts = incident.date_started

    title = u"{}: {}".format(status, alert_rule.name)

    return {
        "fallback": title,
        "title": title,
        "title_link": absolute_uri(
            reverse(
                "sentry-metric-alert",
                kwargs={
                    "organization_slug": incident.organization.slug,
                    "incident_id": incident.identifier,
                },
            )
        ),
        "text": text,
        "fields": [],
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


def strip_channel_name(name):
    return name.lstrip(strip_channel_chars)


def get_channel_id(organization, integration_id, name):
    name = strip_channel_name(name)
    try:
        integration = Integration.objects.get(
            provider="slack", organizations=organization, id=integration_id
        )
    except Integration.DoesNotExist:
        return None

    # XXX(meredith): For large accounts that have many, many channels it's
    # possible for us to timeout while attempting to paginate through to find the channel id
    # This means some users are unable to create/update alert rules. To avoid this, we attempt
    # to find the channel id asynchronously if it takes longer than a certain amount of time,
    # which I have set as the SLACK_DEFAULT_TIMEOUT - arbitrarily - to 10 seconds.
    return get_channel_id_with_timeout(integration, name, SLACK_DEFAULT_TIMEOUT)


def get_channel_id_with_timeout(integration, name, timeout):
    """
    Fetches the internal slack id of a channel.
    :param organization: The organization that is using this integration
    :param integration_id: The integration id of this slack integration
    :param name: The name of the channel
    :return: a tuple of three values
        1. prefix: string (`"#"` or `"@"`)
        2. channel_id: string or `None`
        3. timed_out: boolean (whether we hit our self-imposed time limit)
    """

    token_payload = {"token": integration.metadata["access_token"]}

    # Look for channel ID
    payload = dict(token_payload, **{"exclude_archived": False, "exclude_members": True})

    time_to_quit = time.time() + timeout

    client = SlackClient()
    for list_type, result_name, prefix in LIST_TYPES:
        cursor = ""
        while True:
            endpoint = "/%s.list" % list_type
            try:
                # Slack limits the response of `<list_type>.list` to 1000 channels
                items = client.get(endpoint, params=dict(payload, cursor=cursor, limit=1000))
            except ApiError as e:
                logger.info(
                    "rule.slack.%s_list_failed" % list_type, extra={"error": six.text_type(e)}
                )
                return (prefix, None, False)

            item_id = {c["name"]: c["id"] for c in items[result_name]}.get(name)
            if item_id:
                return (prefix, item_id, False)

            cursor = items.get("response_metadata", {}).get("next_cursor", None)
            if time.time() > time_to_quit:
                return (prefix, None, True)

            if not cursor:
                break

    return (prefix, None, False)


def send_incident_alert_notification(action, incident):
    channel = action.target_identifier
    integration = action.integration
    attachment = build_incident_attachment(incident)
    payload = {
        "token": integration.metadata["access_token"],
        "channel": channel,
        "attachments": json.dumps([attachment]),
    }

    client = SlackClient()
    try:
        client.post("/chat.postMessage", data=payload, timeout=5)
    except ApiError as e:
        logger.info("rule.fail.slack_post", extra={"error": six.text_type(e)})
