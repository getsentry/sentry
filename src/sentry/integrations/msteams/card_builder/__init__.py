from __future__ import annotations

from typing import Any, Mapping, Sequence, Tuple, Union

from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.integrations.msteams.card_builder.utils import IssueConstants
from sentry.integrations.slack.message_builder.issues import (
    build_attachment_text,
    build_attachment_title,
    build_footer,
    format_actor_option,
    format_actor_options,
)
from sentry.models import Event, GroupStatus, Integration, Project
from sentry.models.group import Group
from sentry.models.rule import Rule

from ..utils import ACTION_TYPE
from .base import MSTeamsMessageBuilder
from .block import (
    ActionType,
    TextSize,
    TextWeight,
    create_action_block,
    create_action_set_block,
    create_column_block,
    create_column_set_block,
    create_container_block,
    create_input_choice_set_block,
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
# NOTE: Instead of Any, it should have been block, but mypy does not support cyclic definition.
ContainerBlock = Mapping[str, Any]

Block = Union[TextBlock, ImageBlock, ColumnSetBlock, ContainerBlock]

InputChoiceSetBlock = Mapping[str, Union[str, Sequence[Mapping[str, Any]]]]

# Maps to Any because Actions can have an arbitrarily nested data field.
Action = Mapping[str, Any]
ActionSet = Mapping[str, Union[str, Sequence[Action]]]

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


def build_group_footer(group: Group, rules: Sequence[Rule], event: Event) -> ColumnSetBlock:
    project = Project.objects.get_from_cache(id=group.project_id)

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


def build_input_choice_card(
    data: Any,
    card_title: str,
    input_id: str,
    submit_button_title: str,
    choices: Sequence[Tuple[str, Any]],
    default_choice: Any = None,
) -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        title=create_text_block(card_title, weight=TextWeight.BOLDER),
        text=create_input_choice_set_block(
            id=input_id, choices=choices, default_choice=default_choice
        ),
        actions=[create_action_block(ActionType.SUBMIT, title=submit_button_title, data=data)],
    )


def create_issue_action_block(
    event: Event,
    rules: Sequence[Rule],
    integration: Integration,
    toggled: bool,
    action: ACTION_TYPE,
    action_title: str,
    reverse_action: ACTION_TYPE,
    reverse_action_title: str,
    **card_kwargs: Any,
) -> Action:
    if toggled:
        data = generate_action_payload(reverse_action, event, rules, integration)
        return create_action_block(ActionType.SUBMIT, title=reverse_action_title, data=data)

    data = generate_action_payload(action, event, rules, integration)
    card = build_input_choice_card(data=data, **card_kwargs)
    return create_action_block(ActionType.SHOW_CARD, title=action_title, card=card)


def get_teams_choices(group: Group) -> Sequence[Tuple[str, str]]:
    teams = group.project.teams.all().order_by("slug")
    return [("Me", ME)] + [(team["text"], team["value"]) for team in format_actor_options(teams)]


def build_group_actions(group: Group, event: Event, rules: Rule, integration: Integration):
    status = group.get_status()

    resolve_action = create_issue_action_block(
        event=event,
        rules=rules,
        integration=integration,
        toggled=GroupStatus.RESOLVED == status,
        action=ACTION_TYPE.RESOLVE,
        action_title=IssueConstants.RESOLVE,
        reverse_action=ACTION_TYPE.UNRESOLVE,
        reverse_action_title=IssueConstants.UNRESOLVE,
        # card_kwargs
        card_title=IssueConstants.RESOLVE,
        submit_button_title=IssueConstants.RESOLVE,
        input_id=IssueConstants.RESOLVE_INPUT_ID,
        choices=IssueConstants.RESOLVE_INPUT_CHOICES,
    )

    ignore_action = create_issue_action_block(
        event=event,
        rules=rules,
        integration=integration,
        toggled=GroupStatus.IGNORED == status,
        action=ACTION_TYPE.IGNORE,
        action_title=IssueConstants.IGNORE,
        reverse_action=ACTION_TYPE.UNRESOLVE,
        reverse_action_title=IssueConstants.STOP_IGNORING,
        # card_kwargs
        card_title=IssueConstants.IGNORE_INPUT_TITLE,
        submit_button_title=IssueConstants.IGNORE,
        input_id=IssueConstants.IGNORE_INPUT_ID,
        choices=IssueConstants.IGNORE_INPUT_CHOICES,
    )

    teams_choices = get_teams_choices(group)

    assign_action = create_issue_action_block(
        event=event,
        rules=rules,
        integration=integration,
        toggled=group.get_assignee(),
        action=ACTION_TYPE.ASSIGN,
        action_title=IssueConstants.ASSIGN,
        reverse_action=ACTION_TYPE.UNASSIGN,
        reverse_action_title=IssueConstants.UNASSIGN,
        # card_kwargs
        card_title=IssueConstants.ASSIGN_INPUT_TITLE,
        submit_button_title=IssueConstants.ASSIGN,
        input_id=IssueConstants.ASSIGN_INPUT_ID,
        choices=teams_choices,
        default_choice=ME,
    )

    return create_container_block(
        create_action_set_block(
            resolve_action,
            ignore_action,
            assign_action,
        )
    )


def build_assignee_note(group):
    assignee = group.get_assignee()
    if assignee:
        assignee_text = format_actor_option(assignee)["text"]

        return create_text_block(
            IssueConstants.ASSIGNEE_NOTE.format(assignee=assignee_text),
            size=TextSize.SMALL,
        )


def build_group_card(group, event, rules, integration):
    title = build_group_title(group)
    body = [title]

    desc = build_group_descr(group)
    if desc:
        body.append(desc)

    footer = build_group_footer(group, rules, event)
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
