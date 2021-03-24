from enum import Enum


class ExternalProviders(Enum):
    GITHUB = 0
    GITLAB = 1
    EMAIL = 100
    SLACK = 110


EXTERNAL_PROVIDERS = {
    ExternalProviders.GITHUB: "github",
    ExternalProviders.GITLAB: "gitlab",
    ExternalProviders.EMAIL: "email",
    ExternalProviders.SLACK: "slack",
}
