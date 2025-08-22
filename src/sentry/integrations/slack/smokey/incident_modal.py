from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate
from sentry.smokey.models.incidentcomponent import IncidentComponent


def get_incident_modal_view(
    template: IncidentCaseTemplate, components: list[IncidentComponent]
) -> dict:

    return {
        "type": "modal",
        "callback_id": "new_incident_modal",
        "title": {"type": "plain_text", "text": "Declare Incident", "emoji": True},
        "submit": {"type": "plain_text", "text": "Declare Incident", "emoji": True},
        "close": {"type": "plain_text", "text": "Cancel", "emoji": True},
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": "We're ready to help you tackle the incident, fill out the form below to get the process started.",
                },
            },
            {
                "type": "input",
                "block_id": "title_block",
                "label": {
                    "type": "plain_text",
                    "text": "Incident Title",
                    "emoji": True,
                },
                "element": {
                    "type": "plain_text_input",
                    "action_id": "title",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "e.g., Database connection timeout",
                    },
                    "max_length": 100,
                },
            },
            {
                "type": "input",
                "block_id": "description_block",
                "label": {"type": "plain_text", "text": "Description", "emoji": True},
                "optional": True,
                "element": {
                    "type": "plain_text_input",
                    "action_id": "description",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Describe what happened and current impact",
                    },
                    "multiline": True,
                    "max_length": 1000,
                },
            },
            {
                "type": "input",
                "block_id": "severity_block",
                "label": {"type": "plain_text", "text": "Severity", "emoji": True},
                "element": {
                    "type": "static_select",
                    "action_id": "severity",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select severity level",
                        "emoji": True,
                    },
                    "options": [
                        {
                            "text": {
                                "type": "plain_text",
                                "text": f"{template.severity_handle}{i}",
                                "emoji": True,
                            },
                            "value": str(i),
                        }
                        for i in [0, 1, 2, 3, 4]
                    ],
                },
            },
            {
                "type": "input",
                "block_id": "status_block",
                "label": {"type": "plain_text", "text": "Status", "emoji": True},
                "element": {
                    "type": "static_select",
                    "action_id": "status",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select current status",
                        "emoji": True,
                    },
                    "options": [
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Investigating",
                                "emoji": True,
                            },
                            "value": "investigating",
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Identified",
                                "emoji": True,
                            },
                            "value": "identified",
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Monitoring",
                                "emoji": True,
                            },
                            "value": "monitoring",
                        },
                        {
                            "text": {
                                "type": "plain_text",
                                "text": "Resolved",
                                "emoji": True,
                            },
                            "value": "resolved",
                        },
                    ],
                },
            },
            {
                "type": "input",
                "block_id": "user_select_block",
                "label": {
                    "type": "plain_text",
                    "text": f"{template.case_lead_title}",
                    "emoji": True,
                },
                "element": {
                    "type": "users_select",
                    "action_id": "user_select",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select a user",
                        "emoji": True,
                    },
                },
            },
            {
                "type": "input",
                "block_id": "components_block",
                "label": {
                    "type": "plain_text",
                    "text": "Affected Components",
                    "emoji": True,
                },
                "element": {
                    "type": "multi_static_select",
                    "action_id": "components",
                    "placeholder": {
                        "type": "plain_text",
                        "text": "Select affected components",
                        "emoji": True,
                    },
                    "options": [
                        {
                            "text": {
                                "type": "plain_text",
                                "text": f"{component.name}",
                                "emoji": True,
                            },
                            "value": str(component.id),
                        }
                        for component in components
                    ],
                },
            },
        ],
    }
