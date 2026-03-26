from sentry.integrations.slack.actions.notification import SlackNotifyServiceAction
from sentry.integrations.types import IntegrationProviderSlug


class SlackStagingNotifyServiceAction(SlackNotifyServiceAction):
    id = "sentry.integrations.slack.staging.notify_action.SlackStagingNotifyServiceAction"
    prompt = "Send a Slack (Staging) notification"
    provider = IntegrationProviderSlug.SLACK_STAGING.value
    label = "Send a notification from the Staging app to the {workspace} Slack workspace to {channel} (optionally, an ID: {channel_id}) and show tags {tags} and notes {notes} in notification"
