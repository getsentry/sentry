from __future__ import annotations

from typing import Any, Mapping, Sequence, Union

from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models import Group, GroupStatus, Project, Team, User
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri

from ..utils import ACTION_TYPE

ME = "ME"

# TODO: Covert these types to a class hierarchy.
# This is not ideal, but better than no typing. These types should be
# converted to a class hierarchy and messages should be built by composition.

TextBlock = Mapping[str, Union[str, bool]]
ImageBlock = Mapping[str, str]
ItemBlock = Union[str, TextBlock, ImageBlock]

ColumnBlock = Mapping[str, Union[str, Sequence[ItemBlock]]]
ColumnSetBlock = Mapping[str, Union[str, Sequence[ColumnBlock]]]

Block = Union[TextBlock, ImageBlock, ColumnSetBlock]

# Maps to Any because Actions can have an arbitrarily nested data field.
Action = Mapping[str, Any]

AdaptiveCard = Mapping[str, Union[str, Sequence[Block], Sequence[Action]]]


def generate_action_payload(action_type, event, rules, integration):
    # we need nested data or else Teams won't handle the payload correctly
    return {
        "payload": {
            "actionType": action_type,
            "groupId": event.group.id,
            "eventId": event.event_id,
            "rules": [rule.id for rule in rules],
            "integrationId": integration.id,
        }
    }


def get_assignee_string(group: Group) -> str | None:
    """Get a string representation of the group's assignee."""
    assignee = group.get_assignee()
    if isinstance(assignee, User):
        return assignee.email

    if isinstance(assignee, Team):
        return f"#{assignee.slug}"

    return None


def build_group_title(group):
    # TODO: implement with event as well
    ev_metadata = group.get_event_metadata()
    ev_type = group.get_event_type()

    if ev_type == "error" and "type" in ev_metadata:
        text = ev_metadata["type"]
    else:
        text = group.title

    link = group.get_absolute_url(params={"referrer": "msteams"})

    title_text = f"[{text}]({link})"
    return {
        "type": "TextBlock",
        "size": "Large",
        "weight": "Bolder",
        "text": title_text,
        "wrap": True,
    }


def build_group_descr(group):
    # TODO: implement with event as well
    ev_type = group.get_event_type()
    if ev_type == "error":
        ev_metadata = group.get_event_metadata()
        text = ev_metadata.get("value") or ev_metadata.get("function")
        return {
            "type": "TextBlock",
            "size": "Medium",
            "weight": "Bolder",
            "text": text,
            "wrap": True,
        }
    else:
        return None


def build_rule_url(rule, group, project):
    org_slug = group.organization.slug
    project_slug = project.slug
    rule_url = f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule.id}/details/"
    return absolute_uri(rule_url)


def build_group_footer(group, rules, project, event):
    # TODO: implement with event as well
    image_column = {
        "type": "Column",
        "items": [
            {
                "type": "Image",
                "url": absolute_uri(get_asset_url("sentry", "images/sentry-glyph-black.png")),
                "height": "20px",
            }
        ],
        "width": "auto",
    }

    text = f"{group.qualified_short_id}"
    if rules:
        rule_url = build_rule_url(rules[0], group, project)
        text += f" via [{rules[0].label}]({rule_url})"
        if len(rules) > 1:
            text += f" (+{len(rules) - 1} other)"

    text_column = {
        "type": "Column",
        "items": [{"type": "TextBlock", "size": "Small", "weight": "Lighter", "text": text}],
        "isSubtle": True,
        "width": "auto",
        "spacing": "none",
    }

    date_ts = group.last_seen
    if event:
        event_ts = event.datetime
        date_ts = max(date_ts, event_ts)

    date = date_ts.replace(microsecond=0).isoformat()
    date_text = f"{{{{DATE({date}, SHORT)}}}} at {{{{TIME({date})}}}}"
    date_column = {
        "type": "Column",
        "items": [
            {
                "type": "TextBlock",
                "size": "Small",
                "weight": "Lighter",
                "horizontalAlignment": "Center",
                "text": date_text,
            }
        ],
        "width": "auto",
    }

    return {"type": "ColumnSet", "columns": [image_column, text_column, date_column]}


def build_group_actions(group, event, rules, integration):
    status = group.get_status()

    if status == GroupStatus.RESOLVED:
        resolve_action = {
            "type": "Action.Submit",
            "title": "Unresolve",
            "data": generate_action_payload(ACTION_TYPE.UNRESOLVE, event, rules, integration),
        }
    else:
        resolve_action = {
            "type": "Action.ShowCard",
            "version": "1.2",
            "title": "Resolve",
            "card": {
                "type": "AdaptiveCard",
                "body": [
                    {"type": "TextBlock", "text": "Resolve", "weight": "Bolder"},
                    {
                        "type": "Input.ChoiceSet",
                        "id": "resolveInput",
                        "choices": [
                            {"title": "Immediately", "value": "resolved"},
                            {
                                "title": "In the current release",
                                "value": "resolved:inCurrentRelease",
                            },
                            {"title": "In the next release", "value": "resolved:inNextRelease"},
                        ],
                    },
                ],
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Resolve",
                        "data": generate_action_payload(
                            ACTION_TYPE.RESOLVE, event, rules, integration
                        ),
                    }
                ],
            },
        }

    if status == GroupStatus.IGNORED:
        ignore_action = {
            "type": "Action.Submit",
            "title": "Stop Ignoring",
            "data": generate_action_payload(ACTION_TYPE.UNRESOLVE, event, rules, integration),
        }
    else:
        ignore_action = {
            "type": "Action.ShowCard",
            "version": "1.2",
            "title": "Ignore",
            "card": {
                "type": "AdaptiveCard",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "Ignore until this happens again...",
                        "weight": "Bolder",
                    },
                    {
                        "type": "Input.ChoiceSet",
                        "id": "ignoreInput",
                        "choices": [
                            {"title": "Ignore indefinitely", "value": -1},
                            {"title": "1 time", "value": 1},
                            {"title": "10 times", "value": 10},
                            {"title": "100 times", "value": 100},
                            {"title": "1,000 times", "value": 1000},
                            {"title": "10,000 times", "value": 10000},
                        ],
                    },
                ],
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Ignore",
                        "data": generate_action_payload(
                            ACTION_TYPE.IGNORE, event, rules, integration
                        ),
                    }
                ],
            },
        }

    if get_assignee_string(group):
        assign_action = {
            "type": "Action.Submit",
            "title": "Unassign",
            "data": generate_action_payload(ACTION_TYPE.UNASSIGN, event, rules, integration),
        }
    else:
        teams_list = group.project.teams.all().order_by("slug")
        teams = [{"title": f"#{u.slug}", "value": f"team:{u.id}"} for u in teams_list]
        teams = [{"title": "Me", "value": ME}] + teams
        assign_action = {
            "type": "Action.ShowCard",
            "version": "1.2",
            "title": "Assign",
            "card": {
                "type": "AdaptiveCard",
                "body": [
                    {"type": "Input.ChoiceSet", "id": "assignInput", "value": ME, "choices": teams}
                ],
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Assign",
                        "data": generate_action_payload(
                            ACTION_TYPE.ASSIGN, event, rules, integration
                        ),
                    }
                ],
            },
        }

    return {
        "type": "Container",
        "items": [{"type": "ActionSet", "actions": [resolve_action, ignore_action, assign_action]}],
    }


def build_group_resolve_card(group, event, rules, integration):
    return [
        {
            "type": "TextBlock",
            "size": "Large",
            "text": "Resolve",
            "weight": "Bolder",
            "id": "resolveTitle",
            "isVisible": False,
        }
    ]


def build_group_ignore_card(group, event, rules, integration):
    return [
        {
            "type": "TextBlock",
            "size": "Large",
            "text": "Ignore until this happens again...",
            "weight": "Bolder",
            "id": "ignoreTitle",
            "isVisible": False,
        }
    ]


def build_group_assign_card(group, event, rules, integration):
    return [
        {
            "type": "TextBlock",
            "size": "Large",
            "text": "Assign to...",
            "weight": "Bolder",
            "id": "assignTitle",
            "isVisible": False,
        }
    ]


def build_group_action_cards(group, event, rules, integration):
    status = group.get_status()
    action_cards = []
    if status != GroupStatus.RESOLVED:
        action_cards += build_group_resolve_card(group, event, rules, integration)
    if status != GroupStatus.IGNORED:
        action_cards += build_group_ignore_card(group, event, rules, integration)
    action_cards += build_group_assign_card(group, event, rules, integration)

    return {"type": "ColumnSet", "columns": [{"type": "Column", "items": action_cards}]}


def build_assignee_note(group):
    assignee = get_assignee_string(group)
    if not assignee:
        return None
    return {"type": "TextBlock", "size": "Small", "text": f"**Assigned to {assignee}**"}


def build_group_card(group, event, rules, integration):
    project = Project.objects.get_from_cache(id=group.project_id)

    title = build_group_title(group)
    body = [title]

    desc = build_group_descr(group)
    if desc:
        body.append(desc)

    footer = build_group_footer(group, rules, project, event)
    body.append(footer)

    assignee_note = build_assignee_note(group)
    if assignee_note:
        body.append(assignee_note)

    actions = build_group_actions(group, event, rules, integration)
    body.append(actions)

    return {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
        "body": body,
    }


def build_incident_attachment(incident, new_status, metric_value=None):
    data = incident_attachment_info(incident, new_status, metric_value)

    colors = {"Resolved": "good", "Warning": "warning", "Critical": "attention"}

    footer_text = "Sentry Incident | {}".format(data["ts"].strftime("%b %d"))

    return {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
        "body": [
            {
                "type": "ColumnSet",
                "columns": [
                    {
                        "type": "Column",
                        "style": colors[data["status"]],
                        "items": [],
                        "width": "20px",
                    },
                    {
                        "type": "Column",
                        "items": [
                            {
                                "type": "Container",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "[{}]({})".format(
                                            data["title"], data["title_link"]
                                        ),
                                        "fontType": "Default",
                                        "weight": "Bolder",
                                    },
                                    {"type": "TextBlock", "text": data["text"], "isSubtle": True},
                                    {
                                        "type": "ColumnSet",
                                        "columns": [
                                            {
                                                "type": "Column",
                                                "items": [
                                                    {
                                                        "type": "Image",
                                                        "url": data["logo_url"],
                                                        "size": "Small",
                                                        "width": "20px",
                                                    }
                                                ],
                                                "width": "auto",
                                            },
                                            {
                                                "type": "Column",
                                                "items": [
                                                    {
                                                        "type": "TextBlock",
                                                        "spacing": "None",
                                                        "text": footer_text,
                                                        "isSubtle": True,
                                                        "wrap": True,
                                                        "height": "stretch",
                                                    }
                                                ],
                                                "width": "stretch",
                                            },
                                        ],
                                    },
                                ],
                            }
                        ],
                        "width": "stretch",
                    },
                ],
            }
        ],
    }
