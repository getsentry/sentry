import logging
from typing import Any, Mapping, MutableMapping, Optional, Sequence, Tuple

from django import forms
from django.core.exceptions import ValidationError
from django.utils.translation import ugettext_lazy as _

from sentry.eventstore.models import Event
from sentry.integrations.slack.message_builder.issues import build_group_attachment
from sentry.models import Integration
from sentry.rules.actions.base import IntegrationEventAction
from sentry.rules.processor import RuleFuture
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiRateLimitedError,
    DuplicateDisplayNameError,
)
from sentry.utils import json, metrics

from .client import SlackClient
from .utils import (
    SLACK_RATE_LIMITED_MESSAGE,
    get_channel_id,
    strip_channel_name,
    validate_channel_id,
)

logger = logging.getLogger("sentry.rules")


class SlackNotifyServiceForm(forms.Form):  # type: ignore
    workspace = forms.ChoiceField(choices=(), widget=forms.Select())
    channel = forms.CharField(widget=forms.TextInput())
    channel_id = forms.CharField(required=False, widget=forms.TextInput())
    tags = forms.CharField(required=False, widget=forms.TextInput())

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        # NOTE: Workspace maps directly to the integration ID
        workspace_list = [(i.id, i.name) for i in kwargs.pop("integrations")]
        self.channel_transformer = kwargs.pop("channel_transformer")

        super().__init__(*args, **kwargs)

        if workspace_list:
            self.fields["workspace"].initial = workspace_list[0][0]

        self.fields["workspace"].choices = workspace_list
        self.fields["workspace"].widget.choices = self.fields["workspace"].choices

        # XXX(meredith): When this gets set to True, it lets the RuleSerializer
        # know to only save if and when we have the channel_id. The rule will get saved
        # in the task (integrations/slack/tasks.py) if the channel_id is found.
        self._pending_save = False

    def clean(self) -> Mapping[str, Any]:
        channel_id = self.data.get("inputChannelId") or self.data.get("input_channel_id")
        if channel_id:
            logger.info(
                "rule.slack.provide_channel_id",
                extra={
                    "slack_integration_id": self.data.get("workspace"),
                    "channel_id": self.data.get("channel_id"),
                },
            )
            # default to "#" if they have the channel name without the prefix
            channel_prefix = self.data["channel"][0] if self.data["channel"][0] == "@" else "#"

        cleaned_data: MutableMapping[str, Any] = super().clean()

        workspace: Optional[int] = cleaned_data.get("workspace")

        if channel_id:
            try:
                validate_channel_id(
                    self.data.get("channel"),
                    integration_id=workspace,
                    input_channel_id=channel_id,
                )
            except ValidationError as e:
                params = {"channel": self.data.get("channel"), "channel_id": channel_id}
                raise forms.ValidationError(
                    _(
                        str(e),
                    ),
                    code="invalid",
                    params=params,
                )
        try:
            integration = Integration.objects.get(id=workspace)
        except Integration.DoesNotExist:
            raise forms.ValidationError(
                _(
                    "Slack workspace is a required field.",
                ),
                code="invalid",
            )

        channel = cleaned_data.get("channel", "")

        # XXX(meredith): If the user is creating/updating a rule via the API and provides
        # the channel_id in the request, we don't need to call the channel_transformer - we
        # are assuming that they passed in the correct channel_id for the channel
        if not channel_id:
            try:
                channel_prefix, channel_id, timed_out = self.channel_transformer(
                    integration, channel
                )
            except DuplicateDisplayNameError:
                domain = integration.metadata["domain_name"]

                params = {"channel": channel, "domain": domain}

                raise forms.ValidationError(
                    _(
                        'Multiple users were found with display name "%(channel)s". Please use your username, found at %(domain)s/account/settings#username.',
                    ),
                    code="invalid",
                    params=params,
                )
            except ApiRateLimitedError:
                raise forms.ValidationError(_(SLACK_RATE_LIMITED_MESSAGE))

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


class SlackNotifyServiceAction(IntegrationEventAction):  # type: ignore
    form_cls = SlackNotifyServiceForm
    label = "Send a notification to the {workspace} Slack workspace to {channel} (optionally, an ID: {channel_id}) and show tags {tags} in notification"
    prompt = "Send a Slack notification"
    provider = "slack"
    integration_key = "workspace"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.form_fields = {
            "workspace": {
                "type": "choice",
                "choices": [(i.id, i.name) for i in self.get_integrations()],
            },
            "channel": {"type": "string", "placeholder": "i.e #critical"},
            "channel_id": {"type": "string", "placeholder": "i.e. CA2FRA079 or UA1J9RTE1"},
            "tags": {"type": "string", "placeholder": "i.e environment,user,my_tag"},
        }

    def after(self, event: Event, state: str) -> Any:
        channel = self.get_option("channel_id")
        tags = set(self.get_tags_list())

        try:
            integration = self.get_integration()
        except Integration.DoesNotExist:
            # Integration removed, rule still active.
            return

        def send_notification(event: Event, futures: Sequence[RuleFuture]) -> None:
            rules = [f.rule for f in futures]
            attachments = [build_group_attachment(event.group, event=event, tags=tags, rules=rules)]

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
                        "error": str(e),
                        "project_id": event.project_id,
                        "event_id": event.event_id,
                        "channel_name": self.get_option("channel"),
                    },
                )

        key = f"slack:{integration.id}:{channel}"

        metrics.incr("notifications.sent", instance="slack.notification", skip_internal=False)
        yield self.future(send_notification, key=key)

    def render_label(self) -> str:
        tags = self.get_tags_list()

        return self.label.format(
            workspace=self.get_integration_name(),
            channel=self.get_option("channel"),
            channel_id=self.get_option("channel_id"),
            tags="[{}]".format(", ".join(tags)),
        )

    def get_tags_list(self) -> Sequence[str]:
        return [s.strip() for s in self.get_option("tags", "").split(",")]

    def get_form_instance(self) -> Any:
        return self.form_cls(
            self.data, integrations=self.get_integrations(), channel_transformer=self.get_channel_id
        )

    def get_channel_id(
        self, integration: Integration, name: str
    ) -> Tuple[str, Optional[str], bool]:
        return get_channel_id(self.project.organization, integration, name)
