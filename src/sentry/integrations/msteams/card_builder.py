from typing import Optional

from sentry.integrations.metric_alerts import incident_attachment_info
from sentry.models import Group, GroupStatus, Project, Team, User
from sentry.utils.assets import get_asset_url
from sentry.utils.compat import map
from sentry.utils.http import absolute_uri

from .utils import ACTION_TYPE

ME = "ME"
logo = {
    "type": "Image",
    "url": absolute_uri(get_asset_url("sentry", "images/sentry-glyph-black.png")),
    "size": "Medium",
}


def generate_action_payload(action_type, event, rules, integration):
    rule_ids = map(lambda x: x.id, rules)
    # we need nested data or else Teams won't handle the payload correctly
    return {
        "payload": {
            "actionType": action_type,
            "groupId": event.group.id,
            "eventId": event.event_id,
            "rules": rule_ids,
            "integrationId": integration.id,
        }
    }


def get_assignee_string(group: Group) -> Optional[str]:
    """Get a string representation of the group's assignee."""
    assignee = group.get_assignee()
    if isinstance(assignee, User):
        return assignee.email

    if isinstance(assignee, Team):
        return f"#{assignee.slug}"

    return None


def build_welcome_card(signed_params):
    url = "{}?signed_params={}".format(
        absolute_uri("/extensions/msteams/configure/"),
        signed_params,
    )
    welcome = {
        "type": "TextBlock",
        "weight": "Bolder",
        "size": "Large",
        "text": "Welcome to Sentry for Microsoft Teams",
        "wrap": True,
    }
    description = {
        "type": "TextBlock",
        "text": "You can use Sentry for Microsoft Teams to get notifications that allow you to assign, ignore, or resolve directly in your chat.",
        "wrap": True,
    }
    instruction = {
        "type": "TextBlock",
        "text": (
            "Please click **Complete Setup** to finish the setup process."
            " Don't have a Sentry account? [Sign Up](https://sentry.io/signup/)."
        ),
        "wrap": True,
    }
    button = {
        "type": "Action.OpenUrl",
        "title": "Complete Setup",
        "url": url,
    }
    return {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "ColumnSet",
                "columns": [
                    {"type": "Column", "items": [logo], "width": "auto"},
                    {
                        "type": "Column",
                        "items": [welcome],
                        "width": "stretch",
                        "verticalContentAlignment": "Center",
                    },
                ],
            },
            description,
            instruction,
        ],
        "actions": [button],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_installation_confirmation_message(organization):
    welcome = {
        "type": "TextBlock",
        "weight": "Bolder",
        "size": "Large",
        "text": f"Installation for {organization.name} is successful",
        "wrap": True,
    }
    alert_rule_instructions = {
        "type": "TextBlock",
        "text": "Now that setup is complete, you can continue by configuring alerts.",
        "wrap": True,
    }
    alert_rule_url = absolute_uri(f"organizations/{organization.slug}/rules/")
    alert_rule_button = {
        "type": "Action.OpenUrl",
        "title": "Add Alert Rules",
        "url": alert_rule_url,
    }
    return {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "ColumnSet",
                "columns": [
                    {"type": "Column", "items": [logo], "width": "auto"},
                    {
                        "type": "Column",
                        "items": [welcome],
                        "width": "stretch",
                        "verticalContentAlignment": "Center",
                    },
                ],
            },
            alert_rule_instructions,
        ],
        "actions": [alert_rule_button],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_personal_installation_message():
    welcome = {
        "type": "TextBlock",
        "weight": "Bolder",
        "size": "Large",
        "text": "Personal Installation of Sentry",
        "wrap": True,
    }
    instruction = {
        "type": "TextBlock",
        "text": (
            "It looks like you have installed Sentry as a personal app."
            " Sentry for Microsoft Teams needs to be added to a team. Please add"
            ' Sentry again, and select "Add to a team" from the "Add" button\'s list arrow'
        ),
        "wrap": True,
    }
    return {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "ColumnSet",
                "columns": [
                    {"type": "Column", "items": [logo], "width": "auto"},
                    {
                        "type": "Column",
                        "items": [welcome],
                        "width": "stretch",
                        "verticalContentAlignment": "Center",
                    },
                ],
            },
            instruction,
        ],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_mentioned_card():
    instruction = {
        "type": "TextBlock",
        "text": (
            "Sentry for Microsoft Teams does not support any commands in channels, only in direct messages."
            " To unlink your Microsoft Teams identity from your Sentry account message the personal bot."
        ),
        "wrap": True,
    }

    alert_instruction = {
        "type": "TextBlock",
        "text": (
            "Want to learn more about configuring alerts in Sentry? Check out our documentation."
        ),
        "wrap": True,
    }

    button = {
        "type": "Action.OpenUrl",
        "title": "Docs",
        "url": "https://docs.sentry.io/product/alerts-notifications/alerts/",
    }

    return {
        "type": "AdaptiveCard",
        "body": [instruction, alert_instruction],
        "actions": [button],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_unrecognized_command_card(command_text):
    instruction = {
        "type": "TextBlock",
        "text": (f"Sorry, I didn't understand '{command_text}'."),
        "wrap": True,
    }

    commands = {
        "type": "TextBlock",
        "text": ("Type **help**: to see the list of available commands"),
        "wrap": True,
    }

    return {
        "type": "AdaptiveCard",
        "body": [instruction, commands],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_help_command_card():
    header = {
        "type": "TextBlock",
        "text": ("Please use one of the following commands for Sentry:"),
        "wrap": True,
    }

    commands = {
        "type": "TextBlock",
        "text": (
            "- **link**: link your Microsoft Teams identity to your Sentry account"
            "\n\n- **unlink**: unlink your Microsoft Teams identity from your Sentry account"
            "\n\n- **help**: view list of all bot commands"
        ),
        "wrap": True,
    }

    return {
        "type": "AdaptiveCard",
        "body": [header, commands],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_link_identity_command_card():
    link_identity = {
        "type": "TextBlock",
        "text": (
            "Your Microsoft Teams identity will be linked to your"
            " Sentry account when you interact with alerts from Sentry."
        ),
        "wrap": True,
    }
    return {
        "type": "AdaptiveCard",
        "body": [link_identity],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_unlink_identity_card(unlink_url):
    unlink_identity = {
        "type": "TextBlock",
        "text": "Click below to unlink your identity",
        "wrap": True,
    }
    button = {
        "type": "Action.OpenUrl",
        "title": "Unlink Identity",
        "url": unlink_url,
    }
    return {
        "type": "AdaptiveCard",
        "body": [unlink_identity],
        "actions": [button],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_already_linked_identity_command_card():
    link_identity = {
        "type": "TextBlock",
        "text": ("Your Microsoft Teams identity is already linked to a" " Sentry account."),
        "wrap": True,
    }
    return {
        "type": "AdaptiveCard",
        "body": [link_identity],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


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
    rule_url = f"/organizations/{org_slug}/alerts/rules/{project_slug}/{rule.id}/"
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


def build_linking_card(url):
    desc = {
        "type": "TextBlock",
        "size": "Medium",
        "text": "You need to link your Microsoft Teams account to your Sentry account before you can take action through Teams messages. Please click here to do so.",
        "wrap": True,
    }
    button = {
        "type": "Action.OpenUrl",
        "title": "Link Identities",
        "url": url,
    }
    return {
        "type": "AdaptiveCard",
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
        "body": [desc],
        "actions": [button],
    }


def build_linked_card():
    image = {
        "type": "Image",
        "url": absolute_uri(get_asset_url("sentry", "images/sentry-glyph-black.png")),
        "size": "Large",
    }
    desc = {
        "type": "TextBlock",
        "text": "Your Microsoft Teams identity has been linked to your Sentry account. You're good to go.",
        "size": "Large",
        "wrap": True,
    }
    body = {
        "type": "ColumnSet",
        "columns": [
            {"type": "Column", "items": [image], "width": "auto"},
            {"type": "Column", "items": [desc]},
        ],
    }
    return {
        "type": "AdaptiveCard",
        "body": [body],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_unlinked_card():
    desc = {
        "type": "TextBlock",
        "text": (
            "Your Microsoft Teams identity has been unlinked to your Sentry account."
            " You will need to re-link if you want to interact with messages again."
        ),
        "wrap": True,
    }

    return {
        "type": "AdaptiveCard",
        "body": [desc],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2",
    }


def build_incident_attachment(action, incident, metric_value=None, method=None):
    data = incident_attachment_info(incident, metric_value, action=action, method=method)

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
