from enum import StrEnum


class NotificationType(StrEnum):
    OrganizationInvite = "organization_invite"
    WeeklyDigests = "weekly_digests"
    Workflows = "workflows"
    IssueAlert = "issue_alert"
    SpikeProtection = "spike_protection"
    OrganizationEmailBlast = "organization_email_blast"
    # Billing concerns
    BillingEmail = "billing_email"
    ...

    @staticmethod
    def get_choices() -> list[tuple[str, str]]:
        return [(choice.value, choice.name) for choice in NotificationType]


class ProviderResourceType(StrEnum):
    IdentityLink = "identity_link"
    Channel = "channel"
