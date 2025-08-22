from django.db import router, transaction
from django.utils import timezone

from sentry.integrations.slack.requests.base import SlackDMRequest
from sentry.smokey.hack import DEMO_MEMBER_ID, DEMO_ORG_ID
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
            IncidentCaseComponent.objects.create(case=incident_case, component_id=component)

    post_create_flow(incident_case)

    return incident_case


def post_create_flow(incident_case: IncidentCase) -> None:
    # Step 1: Notify the on-call via pagerduty
    # Step 2: Create an epic in Jira
    # Step 3: Create a channel in Slack
    # Step 4: Send a message to the channel welcoming people (@mention the case lead)
    # Step 5: Create a notion document

    pass
