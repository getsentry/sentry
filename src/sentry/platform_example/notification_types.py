from enum import StrEnum


class NotificationType(StrEnum):
    ORGANIZATION_INVITE = "organization_invite"
    WEEKLY_DIGESTS = "weekly_digests"
    WORKFLOWS = "workflows"
    ISSUE_ALERT = "issue_alert"
    SPIKE_PROTECTION = "spike_protection"
    ORGANIZATION_EMAIL_BLAST = "organization_email_blast"
    # Billing concerns
    BILLING_EMAIL = "billing_email"
    ...

    @staticmethod
    def get_choices() -> list[tuple[str, str]]:
        return [(choice.value, choice.name) for choice in NotificationType]


class ProviderResourceType(StrEnum):
    IDENTITY_LINK = "identity_link"
    CHANNEL = "channel"
    DIRECT_MESSAGE = "direct_message"
    EMAIL = "email"


class NotificationProviderNames(StrEnum):
    EMAIL = "email"
    SLACK = "slack"
    DISCORD = "discord"
