from sentry.integrations.types import ExternalProviderEnum

"""
These mappings represents how to interpret the absence of a DB row for a given
provider. For example, a user with no NotificationSettings should be opted
into receiving emails but no Slack messages.
"""

# email and slack are defaulted to being on
DEFAULT_ENABLED_PROVIDERS = [
    ExternalProviderEnum.EMAIL,
    ExternalProviderEnum.SLACK,
]

DEFAULT_ENABLED_PROVIDERS_VALUES = [
    ExternalProviderEnum.EMAIL.value,
    ExternalProviderEnum.SLACK.value,
]
