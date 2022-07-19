from __future__ import annotations

from typing import Any, Mapping, Sequence, Union

from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.msteams.card_builder.utils import IssueConstants
from sentry.integrations.slack.message_builder.issues import (
    build_attachment_text,
    build_attachment_title,
    build_footer,
    format_actor_option,
)
from sentry.models import Event, GroupStatus, Project
from sentry.models.group import Group
from sentry.models.rule import Rule

from ..utils import ACTION_TYPE
from .block import (
    TextSize,
    TextWeight,
    create_column_block,
    create_column_set_block,
    create_logo_block,
    create_text_block,
)

ME = "ME"
URL_FORMAT = "[{text}]({url})"

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


def build_group_title(group: Group) -> TextBlock:
    text = build_attachment_title(group)

    link = group.get_absolute_url(params={"referrer": "msteams"})

    title_text = f"[{text}]({link})"
    return create_text_block(
        title_text,
        size=TextSize.LARGE,
        weight=TextWeight.BOLDER,
    )


def build_group_descr(group: Group) -> TextBlock:
    # TODO: implement with event as well
    text = build_attachment_text(group)
    if text:
        return create_text_block(
            text,
            size=TextSize.MEDIUM,
            weight=TextWeight.BOLDER,
        )


def create_footer_logo_block():
    return create_logo_block(height="20px")


def create_footer_text_block(footer_text: str) -> TextBlock:
    return create_text_block(
        footer_text,
        size=TextSize.SMALL,
        weight=TextWeight.LIGHTER,
        wrap=False,
    )


def get_timestamp(group: Group, event: Event) -> str:
    ts = group.last_seen

    date = max(ts, event.datetime) if event else ts

    # Adaptive cards is strict about the isoformat.
    date_str: str = date.replace(microsecond=0).isoformat()

    return date_str


def create_date_block(group: Group, event: Event) -> TextBlock:
    date_str = get_timestamp(group, event)

    return create_text_block(
        IssueConstants.DATE_FORMAT.format(date=date_str),
        size=TextSize.SMALL,
        weight=TextWeight.LIGHTER,
        horizontalAlignment="Center",
    )


def build_group_footer(
    group: Group, rules: Sequence[Rule], project: Project, event: Event
) -> ColumnSetBlock:
    # TODO: implement with event as well
    image_column = create_footer_logo_block()

    text = build_footer(group, project, rules, URL_FORMAT)

    text_column = create_column_block(create_footer_text_block(text), isSubtle=True, spacing="none")

    date_column = create_date_block(group, event)

    return create_column_set_block(
        image_column,
        text_column,
        date_column,
    )


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

    if group.get_assignee():
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


def build_assignee_note(group):
    assignee = group.get_assignee()
    if not assignee:
        return None

    assignee_text = format_actor_option(assignee)["text"]

    return {
        "type": "TextBlock",
        "size": "Small",
        "text": f"**Assigned to {assignee_text}**",
    }


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
