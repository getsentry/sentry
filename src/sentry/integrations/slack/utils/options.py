from sentry import options


def has_slack_sdk_flag(organization_id: int) -> bool:
    return organization_id in options.get("slack.sdk-web-client")
