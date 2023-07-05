from __future__ import annotations

# import logging
from typing import Any, Mapping, Sequence

# from django import forms
from django.utils.translation import gettext_lazy as _

# from sentry import options
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)

# from sentry.models import Integration, OrganizationIntegration
from sentry.pipeline import PipelineView

DESCRIPTION = """
Trigger alerts in Opsgenie from Sentry.

Opsgenie is a cloud-based service for dev & ops teams, providing reliable
alerts, on-call schedule management and escalations. Opsgenie integrates with
monitoring tools & services, ensures the right people are notified.
"""


FEATURES = [
    FeatureDescription(
        """
        Manage incidents and outages by sending Sentry notifications to Opsgenie.
        """,
        IntegrationFeatures.INCIDENT_MANAGEMENT,
    ),
    FeatureDescription(
        """
        Configure Sentry rules to trigger notifications based on conditions you set.
        """,
        IntegrationFeatures.ALERT_RULE,
    ),
]

# need to add feature flag?
metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/opsgenie",  # currently incorrect, as it hasn't been merged
    aspects={},
)


class OpsgenieIntegration(IntegrationInstallation):
    pass


class OpsgenieIntegrationProvider(IntegrationProvider):
    key = "opsgenie"
    name = "Opsgenie (Integration)"
    metadata = metadata
    integration_cls = OpsgenieIntegration
    features = frozenset([IntegrationFeatures.INCIDENT_MANAGEMENT, IntegrationFeatures.ALERT_RULE])
    requires_feature_flag = True  # limited release

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        return super().get_pipeline_views()

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        return super().build_integration(state)
