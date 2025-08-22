from enum import StrEnum

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.integrations.slack.message_builder.disconnected import SlackDisconnectedMessageBuilder
from sentry.integrations.slack.requests.base import SlackDMRequest, SlackRequestError
from sentry.integrations.slack.requests.command import SlackCommandRequest
from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.smokey.help import HELP_BLOCKS
from sentry.integrations.slack.smokey.incident_modal import get_incident_modal_view
from sentry.integrations.slack.webhooks.base import SlackDMEndpoint
from sentry.smokey.hack import DEMO_ORG_ID
from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate
from sentry.smokey.models.incidentcomponent import IncidentComponent


class IncidentManagementCommand(StrEnum):
    NEW_INCIDENT = "new"
    HUDDLE = "huddle"
    UPDATE_INCIDENT = "update"
    CLOSE_INCIDENT = "close"
    REOPEN_INCIDENT = "reopen"
    CREATE_STATUS = "status new"
    UPDATE_STATUS = "status update"


@region_silo_endpoint
class SlackIncidentManagementEndpoint(SlackDMEndpoint):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    authentication_classes = ()
    permission_classes = ()
    slack_request_class = SlackCommandRequest

    def handle_help(self, slack_request: SlackDMRequest) -> Response:
        return self.respond(HELP_BLOCKS)

    def handle_new_incident(self, slack_request: SlackDMRequest) -> Response:
        """Open a modal to create a new incident with required fields."""
        slack_client = SlackSdkClient(integration_id=slack_request.integration.id)
        template = IncidentCaseTemplate.objects.filter(
            organization_id=DEMO_ORG_ID,
        ).first()
        if not template:
            return self.respond(HELP_BLOCKS)

        components = IncidentComponent.objects.filter(organization_id=DEMO_ORG_ID)
        view = get_incident_modal_view(template=template, components=list(components))
        slack_client.views_open(trigger_id=slack_request.data.get("trigger_id"), view=view)
        return self.respond()

    def handle_huddle(self, slack_request: SlackDMRequest) -> Response:
        return self.handle_help(slack_request)

    def handle_update_incident(self, slack_request: SlackDMRequest) -> Response:
        return self.handle_help(slack_request)

    def handle_close_incident(self, slack_request: SlackDMRequest) -> Response:
        return self.handle_help(slack_request)

    def handle_reopen_incident(self, slack_request: SlackDMRequest) -> Response:
        return self.handle_help(slack_request)

    def handle_create_status(self, slack_request: SlackDMRequest) -> Response:
        return self.handle_help(slack_request)

    def handle_update_status(self, slack_request: SlackDMRequest) -> Response:
        return self.handle_help(slack_request)

    def post(self, request: Request) -> Response:
        try:
            slack_request = self.slack_request_class(request)
            slack_request.validate()
        except SlackRequestError as e:
            if e.status == status.HTTP_403_FORBIDDEN:
                return self.respond(SlackDisconnectedMessageBuilder().build())
            return self.respond(status=e.status)

        cmd_input = slack_request.get_command_input()

        match cmd_input.cmd_value:
            case IncidentManagementCommand.NEW_INCIDENT:
                return self.handle_new_incident(slack_request)
            case IncidentManagementCommand.HUDDLE:
                return self.handle_huddle(slack_request)
            case IncidentManagementCommand.UPDATE_INCIDENT:
                return self.handle_update_incident(slack_request)
            case IncidentManagementCommand.CLOSE_INCIDENT:
                return self.handle_close_incident(slack_request)
            case IncidentManagementCommand.REOPEN_INCIDENT:
                return self.handle_reopen_incident(slack_request)
            case IncidentManagementCommand.CREATE_STATUS:
                return self.handle_create_status(slack_request)
            case IncidentManagementCommand.UPDATE_STATUS:
                return self.handle_update_status(slack_request)
            case _:
                return self.handle_help(slack_request)
