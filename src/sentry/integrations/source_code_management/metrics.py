import itertools
from dataclasses import dataclass
from enum import Enum

from sentry.integrations.utils.metrics import EventLifecycleMetric, EventLifecycleOutcome


class SCMPipelineViewType(Enum):
    """A specific step in an SCM integration's pipeline that is not a static page."""

    # IdentityProviderPipeline
    IDENTITY_PROVIDER = "IDENTITY_PROVIDER"

    # GitHub
    OAUTH_LOGIN = "OAUTH_LOGIN"
    GITHUB_INSTALLATION = "GITHUB_INSTALLATION"

    # Bitbucket
    VERIFY_INSTALLATION = "VERIFY_INSTALLATION"

    # Bitbucket Server
    # OAUTH_LOGIN = "OAUTH_LOGIN"
    OAUTH_CALLBACK = "OAUTH_CALLBACK"

    # Azure DevOps
    ACCOUNT_CONFIG = "ACCOUNT_CONFIG"

    def __str__(self) -> str:
        return self.value.lower()


@dataclass
class SCMPipelineViewEvent(EventLifecycleMetric):
    """An instance to be recorded of a user going through an integration pipeline view (step)."""

    interaction_type: SCMPipelineViewType
    provider_key: str

    def get_key(self, outcome: EventLifecycleOutcome) -> str:
        # not reporting as SLOs
        root_tokens = ("sentry", "integrations", "installation")
        specific_tokens = (
            "source_code",
            self.provider_key,
            str(self.interaction_type),
            str(outcome),
        )

        return ".".join(itertools.chain(root_tokens, specific_tokens))
