from __future__ import absolute_import

import six

from sentry import analytics

from sentry.api import client
from sentry.api.base import Endpoint
from sentry.models import Group, Project, Identity, IdentityProvider, ApiKey
from sentry.utils import json
from sentry.web.decorators import transaction_start
from sentry.shared_integrations.exceptions import ApiError

from .client import SlackClient
from .link_identity import build_linking_url
from .unlink_identity import build_unlinking_url
from .requests import SlackActionRequest, SlackRequestError
from .utils import build_group_attachment, logger


LINK_IDENTITY_MESSAGE = "Looks like you haven't linked your Sentry account with your Slack identity yet! <{associate_url}|Link your identity now> to perform actions in Sentry through Slack."

UNLINK_IDENTITY_MESSAGE = "Looks like this Slack identity is linked to the Sentry user *{user_email}* who is not a member of organization *{org_name}* used with this Slack integration. <{associate_url}|Unlink your identity now>."

DEFAULT_ERROR_MESSAGE = "Sentry can't perform that action right now on your behalf!"

RESOLVE_SELECTOR = {
    "label": "Resolve issue",
    "type": "select",
    "name": "resolve_type",
    "placeholder": "Select the resolution target",
    "value": "resolved",
    "options": [
        {"label": "Immediately", "value": "resolved"},
        {"label": "In the next release", "value": "resolved:inNextRelease"},
        {"label": "In the current release", "value": "resolved:inCurrentRelease"},
    ],
}


class SlackActionEndpoint(Endpoint):
    authentication_classes = ()
    permission_classes = ()

    def api_error(self, error, action_type, logging_data, error_text):
        logging_data = logging_data.copy()
        logging_data["response"] = six.text_type(error.body)
        logging_data["action_type"] = action_type
        logger.info("slack.action.api-error-pre-message: %s" % six.text_type(logging_data))
        logger.info("slack.action.api-error", extra=logging_data)

        return self.respond(
            {"response_type": "ephemeral", "replace_original": False, "text": error_text}
        )

    def on_assign(self, request, identity, group, action):
        assignee = action["selected_options"][0]["value"]

        if assignee == "none":
            assignee = None

        self.update_group(group, identity, {"assignedTo": assignee})
        analytics.record("integrations.slack.assign", actor_id=identity.user_id)

    def on_status(self, request, identity, group, action, data, integration):
        status = action["value"]

        status_data = status.split(":", 1)
        status = {"status": status_data[0]}

        resolve_type = status_data[-1]

        if resolve_type == "inNextRelease":
            status.update({"statusDetails": {"inNextRelease": True}})
        elif resolve_type == "inCurrentRelease":
            status.update({"statusDetails": {"inRelease": "latest"}})

        self.update_group(group, identity, status)

        analytics.record(
            "integrations.slack.status",
            status=status["status"],
            resolve_type=resolve_type,
            actor_id=identity.user_id,
        )

    def update_group(self, group, identity, data):
        event_write_key = ApiKey(
            organization=group.project.organization, scope_list=["event:write"]
        )

        return client.put(
            path=u"/projects/{}/{}/issues/".format(
                group.project.organization.slug, group.project.slug
            ),
            params={"id": group.id},
            data=data,
            user=identity.user,
            auth=event_write_key,
        )

    def open_resolve_dialog(self, data, group, integration):
        # XXX(epurkhiser): In order to update the original message we have to
        # keep track of the response_url in the callback_id. Definitely hacky,
        # but seems like there's no other solutions [1]:
        #
        # [1]: https://stackoverflow.com/questions/46629852/update-a-bot-message-after-responding-to-a-slack-dialog#comment80795670_46629852
        callback_id = json.dumps(
            {
                "issue": group.id,
                "orig_response_url": data["response_url"],
                "is_message": self.is_message(data),
            }
        )

        dialog = {
            "callback_id": callback_id,
            "title": u"Resolve Issue",
            "submit_label": "Resolve",
            "elements": [RESOLVE_SELECTOR],
        }

        payload = {
            "dialog": json.dumps(dialog),
            "trigger_id": data["trigger_id"],
            "token": integration.metadata["access_token"],
        }

        slack_client = SlackClient()
        try:
            slack_client.post("/dialog.open", data=payload)
        except ApiError as e:
            logger.error("slack.action.response-error", extra={"error": six.text_type(e)})

    def construct_reply(self, attachment, is_message=False):
        # XXX(epurkhiser): Slack is inconsistent about it's expected responses
        # for interactive action requests.
        #
        #  * For _unfurled_ action responses, slack expects the entire
        #    attachment body used to replace the unfurled attachment to be at
        #    the top level of the json response body.
        #
        #  * For _bot posted message_ action responses, slack expects the
        #    attachment body used to replace the attachment to be within an
        #    `attachments` array.
        if is_message:
            attachment = {"attachments": [attachment]}

        return attachment

    def is_message(self, data):
        # XXX(epurkhsier): Used in coordination with construct_reply. Bot
        # posted messages will not have the type at all.
        return data.get("original_message", {}).get("type") == "message"

    @transaction_start("SlackActionEndpoint")
    def post(self, request):
        logging_data = {}

        try:
            slack_request = SlackActionRequest(request)
            slack_request.validate()
        except SlackRequestError as e:
            return self.respond(status=e.status)

        data = slack_request.data

        # if a user is just clicking our auto response in the messages tab we just return a 200
        if (
            data.get("actions")
            and data["actions"][0].get("value", "") == "sentry_docs_link_clicked"
        ):
            return self.respond()

        channel_id = data.get("channel", {}).get("id")
        user_id = data.get("user", {}).get("id")
        response_url = data.get("response_url")

        logging_data["channel_id"] = channel_id
        logging_data["slack_user_id"] = user_id
        logging_data["response_url"] = response_url

        integration = slack_request.integration
        logging_data["integration_id"] = integration.id

        # Determine the issue group action is being taken on
        group_id = slack_request.callback_data["issue"]
        logging_data["group_id"] = group_id

        # Actions list may be empty when receiving a dialog response
        action_list = data.get("actions", [])

        try:
            group = Group.objects.select_related("project__organization").get(
                project__in=Project.objects.filter(
                    organization__in=integration.organizations.all()
                ),
                id=group_id,
            )
        except Group.DoesNotExist:
            logger.error("slack.action.invalid-issue", extra=logging_data)
            return self.respond(status=403)

        logging_data["organization_id"] = group.organization.id

        # Determine the acting user by slack identity
        try:
            idp = IdentityProvider.objects.get(type="slack", external_id=slack_request.team_id)
        except IdentityProvider.DoesNotExist:
            logger.error("slack.action.invalid-team-id", extra=logging_data)
            return self.respond(status=403)

        try:
            identity = Identity.objects.select_related("user").get(idp=idp, external_id=user_id)
        except Identity.DoesNotExist:
            associate_url = build_linking_url(
                integration, group.organization, user_id, channel_id, response_url
            )

            return self.respond(
                {
                    "response_type": "ephemeral",
                    "replace_original": False,
                    "text": LINK_IDENTITY_MESSAGE.format(associate_url=associate_url),
                }
            )

        # Handle status dialog submission
        if slack_request.type == "dialog_submission" and "resolve_type" in data["submission"]:
            # Masquerade a status action
            action = {"name": "status", "value": data["submission"]["resolve_type"]}

            try:
                self.on_status(request, identity, group, action, data, integration)
            except client.ApiError as e:

                if e.status_code == 403:
                    text = UNLINK_IDENTITY_MESSAGE.format(
                        associate_url=build_unlinking_url(
                            integration.id, group.organization.id, user_id, channel_id, response_url
                        ),
                        user_email=identity.user,
                        org_name=group.organization.name,
                    )
                else:
                    text = DEFAULT_ERROR_MESSAGE

                return self.api_error(e, "status_dialog", logging_data, text)

            group = Group.objects.get(id=group.id)
            attachment = build_group_attachment(group, identity=identity, actions=[action])

            body = self.construct_reply(
                attachment, is_message=slack_request.callback_data["is_message"]
            )

            # use the original response_url to update the link attachment
            slack_client = SlackClient()
            try:
                slack_client.post(
                    slack_request.callback_data["orig_response_url"], data=body, json=True
                )
            except ApiError as e:
                logger.error("slack.action.response-error", extra={"error": six.text_type(e)})

            return self.respond()

        # Usually we'll want to respond with the updated attachment including
        # the list of actions taken. However, when opening a dialog we do not
        # have anything to update the message with and will use the
        # response_url later to update it.
        defer_attachment_update = False

        # Handle interaction actions
        action_type = None
        try:
            for action in action_list:
                action_type = action["name"]

                if action_type == "status":
                    self.on_status(request, identity, group, action, data, integration)
                elif action_type == "assign":
                    self.on_assign(request, identity, group, action)
                elif action_type == "resolve_dialog":
                    self.open_resolve_dialog(data, group, integration)
                    defer_attachment_update = True
        except client.ApiError as e:

            if e.status_code == 403:
                text = UNLINK_IDENTITY_MESSAGE.format(
                    associate_url=build_unlinking_url(
                        integration.id, group.organization.id, user_id, channel_id, response_url
                    ),
                    user_email=identity.user,
                    org_name=group.organization.name,
                )
            else:
                text = DEFAULT_ERROR_MESSAGE

            return self.api_error(e, action_type, logging_data, text)

        if defer_attachment_update:
            return self.respond()

        # Reload group as it may have been mutated by the action
        group = Group.objects.get(id=group.id)

        attachment = build_group_attachment(group, identity=identity, actions=action_list)
        body = self.construct_reply(attachment, is_message=self.is_message(data))

        return self.respond(body)
