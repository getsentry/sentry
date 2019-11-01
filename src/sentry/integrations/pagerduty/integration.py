from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _
from django.db import transaction

from sentry import options

from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.integrations.base import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
    FeatureDescription,
)
from sentry.models import OrganizationIntegration, PagerDutyService
from sentry.pipeline import PipelineView
from .client import PagerDutyClient

DESCRIPTION = """
PagerDuty Description
"""

FEATURES = [
    FeatureDescription(
        """
        Configure rule based PagerDuty notifications!!
        """,
        IntegrationFeatures.ALERT_RULE,
    )
]

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=PagerDuty%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/pagerduty",
    aspects={},
)


class PagerDutyIntegration(IntegrationInstallation):
    def get_client(self, integration_key):
        return PagerDutyClient(integration_key=integration_key)

    @property
    def services(self):
        services = PagerDutyService.objects.filter(organization_integration=self.org_integration)

        return services


class PagerDutyIntegrationProvider(IntegrationProvider):
    key = "pagerduty"
    name = "PagerDuty"
    metadata = metadata
    features = frozenset([IntegrationFeatures.ALERT_RULE])
    integration_cls = PagerDutyIntegration

    setup_dialog_config = {"width": 600, "height": 900}

    def get_pipeline_views(self):
        return [PagerDutyInstallationRedirect()]

    def post_install(self, integration, organization):
        services = integration.metadata["services"]
        try:
            org_integration = OrganizationIntegration.objects.get(
                integration=integration, organization=organization
            )
        except OrganizationIntegration.DoesNotExist:
            return

        with transaction.atomic():
            for service in services:
                PagerDutyService.objects.create_or_update(
                    organization_integration=org_integration,
                    integration_key=service["integration_key"],
                    service_id=service["id"],
                    service_name=service["name"],
                )

    def build_integration(self, state):
        config = json.loads(state.get("config"))
        account = config["account"]
        # PagerDuty gives us integration keys for various things, some of which
        # are not services. For now we only care about services.
        services = filter(lambda x: x["type"] == "service", config["integration_keys"])

        return {
            "name": account["name"],
            "external_id": account["subdomain"],
            "metadata": {"services": services},
        }


class PagerDutyInstallationRedirect(PipelineView):
    def get_app_url(self):
        app_id = options.get("pagerduty.app-id")
        setup_url = absolute_uri("/extensions/pagerduty/setup/")

        return (
            u"https://app.pagerduty.com/install/integration?app_id=%s&redirect_url=%s&version=1"
            % (app_id, setup_url)
        )

    def dispatch(self, request, pipeline):
        if "config" in request.GET:
            pipeline.bind_state("config", request.GET["config"])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
