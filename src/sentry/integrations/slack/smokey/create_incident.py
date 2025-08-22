import time

import requests
from django.db import router, transaction
from django.utils import timezone

from sentry import options
from sentry.integrations.jira.client import JiraCloudClient
from sentry.integrations.models.integration import Integration
from sentry.integrations.pagerduty.client import PagerDutyClient
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.slack.requests.base import SlackDMRequest
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.smokey.hack import (
    DEMO_MEMBER_ID,
    DEMO_NOTION_DATABASE_ID,
    DEMO_ORG_ID,
    DEMO_SLACK_USER_ID,
)
from sentry.smokey.models.incidentcase import IncidentCase
from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate
from sentry.smokey.models.incidentcomponent import IncidentCaseComponent, IncidentComponent


def extract_form_values(slack_request: SlackDMRequest) -> dict:
    """Extract form values from the Slack modal submission."""
    view_state = slack_request.data.get("view", {}).get("state", {}).get("values", {})

    return {
        "title": view_state.get("title_block", {}).get("title", {}).get("value", ""),
        "description": view_state.get("description_block", {})
        .get("description", {})
        .get("value", ""),
        "severity": int(
            view_state.get("severity_block", {})
            .get("severity", {})
            .get("selected_option", {})
            .get("value", "0")
        ),
        "status": view_state.get("status_block", {})
        .get("status", {})
        .get("selected_option", {})
        .get("value", ""),
        "user_id": view_state.get("user_select_block", {})
        .get("user_select", {})
        .get("selected_user", ""),
        "component_ids": [
            int(option.get("value", "0"))
            for option in view_state.get("components_block", {})
            .get("components", {})
            .get("selected_options", [])
        ],
    }


@transaction.atomic
def run_create_incident(slack_request: SlackDMRequest) -> IncidentCase:
    """Create an IncidentCase from the Slack modal submission."""

    # Extract form values
    form_data = extract_form_values(slack_request)

    # Get the demo template
    template = IncidentCaseTemplate.objects.filter(organization_id=DEMO_ORG_ID).first()
    if not template:
        raise ValueError("No demo template found for DEMO_ORG_ID")

        # Get selected components
    components = IncidentComponent.objects.filter(id__in=form_data["component_ids"])

    with transaction.atomic(using=router.db_for_write(IncidentCase)):
        incident_case = IncidentCase.objects.create(
            organization_id=DEMO_ORG_ID,
            title=form_data["title"],
            description=form_data["description"],
            severity=form_data["severity"],
            status=form_data["status"],
            case_lead_id=DEMO_MEMBER_ID,
            template=template,
            started_at=timezone.now(),
        )

        for component in components:
            IncidentCaseComponent.objects.create(case=incident_case, component=component)

    post_create_flow(incident_case)

    return incident_case


def post_create_flow(incident_case: IncidentCase) -> None:
    # Step 1: Notify the on-call via pagerduty
    schedule_config = incident_case.template.schedule_config
    short_code = f"{incident_case.template.case_handle}-{incident_case.id}"
    sentry_severity = f"{incident_case.template.severity_handle}{incident_case.severity}"

    schedule_client = PagerDutyClient(
        integration_id=schedule_config.get("integration_id"),
        integration_key=schedule_config.get("service").get("value"),
    )
    schedule_client.send_trigger(
        data={
            "routing_key": schedule_config.get("service").get("value"),
            "event_action": "trigger",
            "payload": {
                "summary": incident_case.title,
                "severity": "error",
                "source": "Sentry Incident Management",
                "custom_details": {
                    "incident_id": incident_case.id,
                    "short_code": short_code,
                    "description": incident_case.description,
                    "sentry_severity": sentry_severity,
                    "sentry_status": incident_case.status,
                    "affected_components": [
                        component.name for component in incident_case.affected_components.all()
                    ],
                },
            },
        }
    )

    # Step 2: Create an epic in Jira
    jira_integration = integration_service.get_integration(
        integration_id=incident_case.template.task_config.get("integrationId")
    )
    client = JiraCloudClient(integration=jira_integration, verify_ssl=True)
    res = client.create_issue(
        raw_form_data={
            "project": incident_case.template.task_config.get("project"),
            "summary": incident_case.title,
            "description": incident_case.description,
            "issuetype": {"id": "10007"},  # Ember -> Task
        }
    )
    jira_url = res.get("self")
    incident_case.task_record = {"key": res.get("key"), "url": jira_url}

    # Step 3: Create a channel in Slack
    slack_client = SlackSdkClient(
        integration_id=incident_case.template.channel_config.get("integrationId")
    )
    res = slack_client.conversations_create(name=short_code.lower())
    time.sleep(1)
    channel_id = res.get("channel", {}).get("id")
    slack_client.conversations_join(channel=channel_id)
    slack_client.conversations_setTopic(channel=channel_id, topic=f"{incident_case.title}")
    slack_client.conversations_setPurpose(
        channel=channel_id, purpose=f"{incident_case.description}"
    )
    slack_client.conversations_invite(
        channel=channel_id,
        users=[DEMO_SLACK_USER_ID],
    )
    slack_client.chat_postMessage(
        channel=channel_id,
        text=f"An incident has been started, use this as a place to work together and remember to be kind with one another.",
    )
    incident_case.channel_record = {"channel_id": channel_id, "channel_name": short_code.lower()}

    # Step 5: Create a notion document
    notion_api_key = options.get("notion.integration-token")
    res = requests.post(
        url=f"https://api.notion.com/v1/pages/",
        headers={
            "Authorization": f"Bearer {notion_api_key}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        },
        json={
            "parent": {"database_id": DEMO_NOTION_DATABASE_ID},
            "properties": {
                "Name": {"title": [{"text": {"content": incident_case.title}}]},
            },
        },
    )
    notion_data = res.json()
    notion_url = notion_data.get("url")
    incident_case.retro_record = notion_data

    # Step 6: Set bookmarks
    slack_client.bookmarks_add(
        channel_id=channel_id,
        title=short_code,
        type="link",
        link=f"https://leeandher.ngrok.io/organizations/{DEMO_ORG_ID}/issues/incidents/{incident_case.id}/",
    )
    slack_client.bookmarks_add(
        channel_id=channel_id,
        title="Epic",
        type="link",
        link=jira_url,
    )
    slack_client.bookmarks_add(
        channel_id=channel_id,
        title="Retro",
        type="link",
        link=notion_url,
    )
    slack_client.bookmarks_add(
        channel_id=channel_id,
        title="Statuspage",
        type="link",
        link=incident_case.template.status_page_config.get("statuspage").get("url"),
    )

    incident_case.save()
