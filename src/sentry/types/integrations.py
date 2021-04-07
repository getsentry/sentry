from enum import Enum
from typing import Optional


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


def get_provider_name(value: int) -> Optional[str]:
    return EXTERNAL_PROVIDERS.get(ExternalProviders(value))
