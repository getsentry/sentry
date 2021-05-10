from typing import List, Mapping, Union

from django.core.cache import cache

from sentry import tagstore
from sentry.integrations.slack.utils import ACTIONED_ISSUE_COLOR, LEVEL_TO_COLOR
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
from sentry.utils import json
from sentry.utils.assets import get_asset_url
from sentry.utils.dates import to_timestamp
from sentry.utils.http import absolute_uri


def format_actor_option(actor: Union[User, Team]):
    if isinstance(actor, User):
        return {"text": actor.get_display_name(), "value": f"user:{actor.id}"}
    if isinstance(actor, Team):
        return {"text": f"#{actor.slug}", "value": f"team:{actor.id}"}

    raise NotImplementedError


def get_member_assignees(group: Group):
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


def get_team_assignees(group: Group):
    return [format_actor_option(u) for u in group.project.teams.all()]


def get_assignee(group: Group):
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
        return "{} - {}".format(ev_metadata["directive"], ev_metadata["uri"])
    else:
        return obj.title


def build_attachment_text(group: Group, event=None):
    # Group and Event both implement get_event_{type,metadata}
    obj = event if event is not None else group
    ev_metadata = obj.get_event_metadata()
    ev_type = obj.get_event_type()

    if ev_type == "error":
        return ev_metadata.get("value") or ev_metadata.get("function")
    else:
        return None


def build_assigned_text(identity: Identity, assignee: str):
    actor = ActorTuple.from_actor_identifier(assignee)

    try:
        assigned_actor = actor.resolve()
    except actor.type.DoesNotExist:
        return

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


def build_action_text(group: Group, identity: Identity, action):
    if action["name"] == "assign":
        return build_assigned_text(identity, action["selected_options"][0]["value"])

    statuses = {"resolved": "resolved", "ignored": "ignored", "unresolved": "re-opened"}

    # Resolve actions have additional 'parameters' after ':'
    status = action["value"].split(":", 1)[0]

    # Action has no valid action text, ignore
    if status not in statuses:
        return

    return "*Issue {status} by <@{user_id}>*".format(
        status=statuses[status], user_id=identity.external_id
    )


def build_rule_url(rule: Rule, group: Group, project: Project, issue_alert: bool):
    org_slug = group.organization.slug
    project_slug = project.slug
    if issue_alert:
        return absolute_uri(rule[1])
    rule_url = f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule.id}/"
    return absolute_uri(rule_url)


def build_footer(group: Group, issue_alert: bool, project: Project, rules=None):
    footer = f"{group.qualified_short_id}"

    if rules:
        rule_url = build_rule_url(rules[0], group, project, issue_alert)
        if issue_alert:
            footer += f" via <{rule_url}|{rules[0][0]}>"
        else:
            footer += f" via <{rule_url}|{rules[0].label}>"

        if len(rules) > 1:
            footer += f" (+{len(rules) - 1} other)"

    return footer


def build_tag_fields(event_for_tags, tags: Mapping[str, str] = None):
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
    group: Group, project: Project, text: str, color: str, actions=None, identity: Identity = None
):
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

    if actions:
        action_texts = [_f for _f in [build_action_text(group, identity, a) for a in actions] if _f]
        text += "\n" + "\n".join(action_texts)

        color = ACTIONED_ISSUE_COLOR
        payload_actions = []

    return payload_actions, text, color


def build_group_attachment(
    group: Group,
    event=None,
    tags: Mapping[str, str] = None,
    identity: Identity = None,
    actions=None,
    rules: List[Rule] = None,
    link_to_event: bool = False,
    issue_alert: bool = False,
):
    # XXX(dcramer): options are limited to 100 choices, even when nested
    logo_url = absolute_uri(get_asset_url("sentry", "images/sentry-email-avatar.png"))
    text = build_attachment_text(group, event) or ""
    project = Project.objects.get_from_cache(id=group.project_id)

    # If an event is unspecified, use the tags of the latest event (if one exists).
    event_for_tags = event if event else group.get_latest_event()

    fallback_color = LEVEL_TO_COLOR["error"]
    color = (
        LEVEL_TO_COLOR.get(event_for_tags.get_tag("level"), fallback_color)
        if event_for_tags
        else fallback_color
    )

    fields = build_tag_fields(event_for_tags, tags)

    ts = group.last_seen

    if event:
        event_ts = event.datetime
        ts = max(ts, event_ts)

    footer = build_footer(group, issue_alert, project, rules)

    obj = event if event is not None else group
    if event and link_to_event:
        title_link = group.get_absolute_url(params={"referrer": "slack"}, event_id=event.event_id)
    elif issue_alert:
        title_link = group.get_absolute_url(params={"referrer": "IssueAlertSlack"})
    else:
        title_link = group.get_absolute_url(params={"referrer": "slack"})

    if not issue_alert:
        payload_actions, text, color = build_actions(group, project, text, color, actions, identity)
    else:
        payload_actions = []

    return {
        "fallback": f"[{project.slug}] {obj.title}",
        "title": build_attachment_title(obj),
        "title_link": title_link,
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
