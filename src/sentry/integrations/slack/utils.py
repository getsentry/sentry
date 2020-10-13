from __future__ import absolute_import

import logging
import time
import six

from django.core.cache import cache
from django.http import Http404

from sentry import tagstore
from sentry.api.fields.actor import Actor
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
    IdentityProvider,
    Integration,
    Organization,
    Team,
    ReleaseProject,
)
from sentry.shared_integrations.exceptions import ApiError, DuplicateDisplayNameError
from sentry.integrations.metric_alerts import incident_attachment_info

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


def get_integration_type(integration):
    metadata = integration.metadata
    # classic bots had a user_access_token in the metadata
    default_installation = "classic_bot" if "user_access_token" in metadata else "workspace_app"
    return metadata.get("installation_type", default_installation)


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


def build_rule_url(rule, group, project):
    org_slug = group.organization.slug
    project_slug = project.slug
    rule_url = u"/organizations/{}/alerts/rules/{}/{}/".format(org_slug, project_slug, rule.id)
    return absolute_uri(rule_url)


def build_upgrade_notice_attachment(group):
    org_slug = group.organization.slug
    url = absolute_uri(
        u"/settings/{}/integrations/slack/?tab=configurations&referrer=slack".format(org_slug)
    )

    return {
        "title": "Deprecation Notice",
        "text": (
            u"This alert is coming from a deprecated version of the Sentry-Slack integration. "
            u"Your Slack integration, along with any data associated with it, will be *permanently deleted on January 14, 2021* "
            u"if you do not transition to the new supported Slack integration. "
            u"Click <{}|here> to complete the process.".format(url)
        ),
    }


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
        rule_url = build_rule_url(rules[0], group, project)
        footer += u" via <{}|{}>".format(rule_url, rules[0].label)

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


def build_incident_attachment(incident, metric_value=None):
    """
    Builds an incident attachment for slack unfurling
    :param incident: The `Incident` to build the attachment for
    :param metric_value: The value of the metric that triggered this alert to fire. If
    not provided we'll attempt to calculate this ourselves.
    :return:
    """

    data = incident_attachment_info(incident, metric_value)

    colors = {
        "Resolved": RESOLVED_COLOR,
        "Warning": LEVEL_TO_COLOR["warning"],
        "Critical": LEVEL_TO_COLOR["fatal"],
    }

    return {
        "fallback": data["title"],
        "title": data["title"],
        "title_link": data["title_link"],
        "text": data["text"],
        "fields": [],
        "mrkdwn_in": ["text"],
        "footer_icon": data["logo_url"],
        "footer": "Sentry Incident",
        "ts": to_timestamp(data["ts"]),
        "color": colors[data["status"]],
        "actions": [],
    }


# Different list types in slack that we'll use to resolve a channel name. Format is
# (<list_name>, <result_name>, <prefix>).
LEGACY_LIST_TYPES = [
    ("channels", "channels", CHANNEL_PREFIX),
    ("groups", "groups", CHANNEL_PREFIX),
    ("users", "members", MEMBER_PREFIX),
]
LIST_TYPES = [("conversations", "channels", CHANNEL_PREFIX), ("users", "members", MEMBER_PREFIX)]


def strip_channel_name(name):
    return name.lstrip(strip_channel_chars)


def get_channel_id(organization, integration, name):
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

    name = strip_channel_name(name)

    # XXX(meredith): For large accounts that have many, many channels it's
    # possible for us to timeout while attempting to paginate through to find the channel id
    # This means some users are unable to create/update alert rules. To avoid this, we attempt
    # to find the channel id asynchronously if it takes longer than a certain amount of time,
    # which I have set as the SLACK_DEFAULT_TIMEOUT - arbitrarily - to 10 seconds.
    return get_channel_id_with_timeout(integration, name, SLACK_DEFAULT_TIMEOUT)


def get_channel_id_with_timeout(integration, name, timeout):
    """
    Fetches the internal slack id of a channel.
    :param integration: The slack integration
    :param name: The name of the channel
    :param timeout: Our self-imposed time limit.
    :return: a tuple of three values
        1. prefix: string (`"#"` or `"@"`)
        2. channel_id: string or `None`
        3. timed_out: boolean (whether we hit our self-imposed time limit)
    """

    token_payload = {"token": integration.metadata["access_token"]}

    # Look for channel ID
    payload = dict(token_payload, **{"exclude_archived": False, "exclude_members": True})

    # workspace tokens are the only tokens that don't works with the conversations.list endpoint,
    # once eveyone is migrated we can remove this check and usages of channels.list
    if get_integration_type(integration) == "workspace_app":
        list_types = LEGACY_LIST_TYPES
    else:
        list_types = LIST_TYPES
        payload = dict(payload, **{"types": "public_channel,private_channel"})

    time_to_quit = time.time() + timeout

    client = SlackClient()
    id_data = None
    found_duplicate = False
    for list_type, result_name, prefix in list_types:
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

            for c in items[result_name]:
                # The "name" field is unique (this is the username for users)
                # so we return immediately if we find a match.
                if c["name"] == name:
                    return (prefix, c["id"], False)
                # If we don't get a match on a unique identifier, we look through
                # the users' display names, and error if there is a repeat.
                if list_type == "users":
                    profile = c.get("profile")
                    if profile and profile.get("display_name") == name:
                        if id_data:
                            found_duplicate = True
                        else:
                            id_data = (prefix, c["id"], False)

            cursor = items.get("response_metadata", {}).get("next_cursor", None)
            if time.time() > time_to_quit:
                return (prefix, None, True)

            if not cursor:
                break
        if found_duplicate:
            raise DuplicateDisplayNameError(name)
        elif id_data:
            return id_data

    return (prefix, None, False)


def send_incident_alert_notification(action, incident, metric_value):
    channel = action.target_identifier
    integration = action.integration
    attachment = build_incident_attachment(incident, metric_value)
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


def get_identity(user, organization_id, integration_id):
    try:
        organization = Organization.objects.get(id__in=user.get_orgs(), id=organization_id)
    except Organization.DoesNotExist:
        raise Http404

    try:
        integration = Integration.objects.get(id=integration_id, organizations=organization)
    except Integration.DoesNotExist:
        raise Http404

    try:
        idp = IdentityProvider.objects.get(external_id=integration.external_id, type="slack")
    except IdentityProvider.DoesNotExist:
        raise Http404

    return organization, integration, idp
