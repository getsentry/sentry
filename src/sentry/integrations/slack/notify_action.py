from __future__ import absolute_import

import random
import logging
import six

import sentry_sdk

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.rules.actions.base import EventAction
from sentry.utils import metrics, json
from sentry.models import Integration
from sentry.shared_integrations.exceptions import ApiError, DuplicateDisplayNameError

from .client import SlackClient
from .utils import (
    build_group_attachment,
    build_upgrade_notice_attachment,
    get_channel_id,
    strip_channel_name,
    get_integration_type,
)

# 50% of messages for workspace apps will get the upgrade CTA
UPGRADE_MESSAGE_FREQUENCY = 0.50
logger = logging.getLogger("sentry.rules")


class SlackNotifyServiceForm(forms.Form):
    workspace = forms.ChoiceField(choices=(), widget=forms.Select())
    channel = forms.CharField(widget=forms.TextInput())
    channel_id = forms.HiddenInput()
    tags = forms.CharField(required=False, widget=forms.TextInput())

    def __init__(self, *args, **kwargs):
        # NOTE: Workspace maps directly to the integration ID
        workspace_list = [(i.id, i.name) for i in kwargs.pop("integrations")]
        self.channel_transformer = kwargs.pop("channel_transformer")

        super(SlackNotifyServiceForm, self).__init__(*args, **kwargs)

        if workspace_list:
            self.fields["workspace"].initial = workspace_list[0][0]

        self.fields["workspace"].choices = workspace_list
        self.fields["workspace"].widget.choices = self.fields["workspace"].choices

        # XXX(meredith): When this gets set to True, it lets the RuleSerializer
        # know to only save if and when we have the channel_id. The rule will get saved
        # in the task (integrations/slack/tasks.py) if the channel_id is found.
        self._pending_save = False

    def clean(self):
        channel_id = None
        if self.data.get("input_channel_id"):
            logger.info(
                "rule.slack.provide_channel_id",
                extra={
                    "slack_integration_id": self.data.get("workspace"),
                    "channel_id": self.data.get("channel_id"),
                },
            )
            # default to "#" if they have the channel name without the prefix
            channel_prefix = self.data["channel"][0] if self.data["channel"][0] == "@" else "#"
            channel_id = self.data["input_channel_id"]

        cleaned_data = super(SlackNotifyServiceForm, self).clean()

        workspace = cleaned_data.get("workspace")
        # TODO(Steve): Add check that workspace exists
        channel = cleaned_data.get("channel", "")

        # XXX(meredith): If the user is creating/updating a rule via the API and provides
        # the channel_id in the request, we don't need to call the channel_transformer - we
        # are assuming that they passed in the correct channel_id for the channel
        if not channel_id:
            try:
                channel_prefix, channel_id, timed_out = self.channel_transformer(workspace, channel)
            except DuplicateDisplayNameError as e:
                integration = Integration.objects.get(id=workspace)
                domain = integration.metadata["domain_name"]

                params = {"channel": e.message, "domain": domain}

                raise forms.ValidationError(
                    _(
                        'Multiple users were found with display name "%(channel)s". Please use your username, found at %(domain)s/account/settings.',
                    ),
                    code="invalid",
                    params=params,
                )

        channel = strip_channel_name(channel)

        if channel_id is None and timed_out:
            cleaned_data["channel"] = channel_prefix + channel
            self._pending_save = True
            return cleaned_data

        if channel_id is None and workspace is not None:
            params = {
                "channel": channel,
                "workspace": dict(self.fields["workspace"].choices).get(int(workspace)),
            }

            raise forms.ValidationError(
                _(
                    'The slack resource "%(channel)s" does not exist or has not been granted access in the %(workspace)s Slack workspace.'
                ),
                code="invalid",
                params=params,
            )

        cleaned_data["channel"] = channel_prefix + channel
        cleaned_data["channel_id"] = channel_id

        return cleaned_data


class SlackNotifyServiceAction(EventAction):
    form_cls = SlackNotifyServiceForm
    label = u"Send a notification to the {workspace} Slack workspace to {channel} and show tags {tags} in notification"
    prompt = "Send a Slack notification"

    def __init__(self, *args, **kwargs):
        super(SlackNotifyServiceAction, self).__init__(*args, **kwargs)
        self.form_fields = {
            "workspace": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "channel": {"type": "string", "placeholder": "i.e #critical"},
            "tags": {"type": "string", "placeholder": "i.e environment,user,my_tag"},
        }

    def is_enabled(self):
        return self.get_integrations().exists()

    def after(self, event, state):
        integration_id = self.get_option("workspace")
        channel = self.get_option("channel_id")
        tags = set(self.get_tags_list())

        try:
            integration = Integration.objects.get(
                provider="slack", organizations=self.project.organization, id=integration_id
            )
        except Integration.DoesNotExist:
            # Integration removed, rule still active.
            return

        def send_notification(event, futures):
            with sentry_sdk.start_transaction(
                op=u"slack.send_notification", name=u"SlackSendNotification", sampled=1.0
            ) as span:
                rules = [f.rule for f in futures]
                attachments = [
                    build_group_attachment(event.group, event=event, tags=tags, rules=rules)
                ]
                # check if we should have the upgrade notice attachment
                integration_type = get_integration_type(integration)
                if integration_type == "workspace_app":
                    if random.uniform(0, 1) < UPGRADE_MESSAGE_FREQUENCY:
                        # stick the upgrade attachment first
                        attachments.insert(0, build_upgrade_notice_attachment(event.group))

                span.set_tag("integration_type", integration_type)
                span.set_tag("has_slack_upgrade_cta", len(attachments) > 1)
                payload = {
                    "token": integration.metadata["access_token"],
                    "channel": channel,
                    "link_names": 1,
                    "attachments": json.dumps(attachments),
                }

                client = SlackClient()
                try:
                    client.post("/chat.postMessage", data=payload, timeout=5)
                except ApiError as e:
                    self.logger.info(
                        "rule.fail.slack_post",
                        extra={
                            "error": six.text_type(e),
                            "project_id": event.project_id,
                            "event_id": event.event_id,
                            "channel_name": self.get_option("channel"),
                        },
                    )

        key = u"slack:{}:{}".format(integration_id, channel)

        metrics.incr("notifications.sent", instance="slack.notification", skip_internal=False)
        yield self.future(send_notification, key=key)

    def render_label(self):
        try:
            integration_name = Integration.objects.get(
                provider="slack",
                organizations=self.project.organization,
                id=self.get_option("workspace"),
            ).name
        except Integration.DoesNotExist:
            integration_name = "[removed]"

        tags = self.get_tags_list()

        return self.label.format(
            workspace=integration_name,
            channel=self.get_option("channel"),
            tags=u"[{}]".format(", ".join(tags)),
        )

    def get_tags_list(self):
        return [s.strip() for s in self.get_option("tags", "").split(",")]

    def get_integrations(self):
        return Integration.objects.filter(provider="slack", organizations=self.project.organization)

    def get_form_instance(self):
        return self.form_cls(
            self.data, integrations=self.get_integrations(), channel_transformer=self.get_channel_id
        )

    def get_channel_id(self, integration_id, name):
        return get_channel_id(self.project.organization, integration_id, name)
