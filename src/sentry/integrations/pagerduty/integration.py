from __future__ import absolute_import


from django.utils.translation import ugettext_lazy as _
from django.db import transaction

from sentry import options

from sentry.utils import json
from sentry.utils.compat import filter
from sentry.utils.http import absolute_uri
from sentry.integrations.base import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
    FeatureDescription,
)
from sentry.shared_integrations.exceptions import IntegrationError

from sentry.models import OrganizationIntegration, PagerDutyService

from sentry.pipeline import PipelineView
from .client import PagerDutyClient

DESCRIPTION = """
Connect your Sentry organization with one or more PagerDuty accounts, and start getting
incidents triggered from Sentry alerts.
"""

FEATURES = [
    FeatureDescription(
        """
        Manage incidents and outages by sending Sentry notifications to PagerDuty.
        """,
        IntegrationFeatures.INCIDENT_MANAGEMENT,
    ),
    FeatureDescription(
        """
        Configure rule based PagerDuty alerts to automatically be triggered in a specific
        service - or in multiple services!
        """,
        IntegrationFeatures.ALERT_RULE,
    ),
]

setup_alert = {
    "type": "info",
    "text": "The PagerDuty integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to PagerDuty you must create a rule using the PagerDuty action in your project settings.",
}

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?title=PagerDuty%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/pagerduty",
    aspects={"alerts": [setup_alert]},
)


class PagerDutyIntegration(IntegrationInstallation):
    def get_client(self, integration_key):
        return PagerDutyClient(integration_key=integration_key)

    def get_organization_config(self):
        fields = [
            {
                "name": "service_table",
                "type": "table",
                "label": "PagerDuty services with the Sentry integration enabled",
                "help": "If services need to be updated, deleted, or added manually please do so here. Alert rules will need to be individually updated for any additions or deletions of services.",
                "addButtonText": "",
                "columnLabels": {"service": "Service", "integration_key": "Integration Key"},
                "columnKeys": ["service", "integration_key"],
                "confirmDeleteMessage": "Any alert rules associated with this service will stop working. The rules will still exist but will show a `removed` service.",
            }
        ]

        return fields

    def update_organization_config(self, data):
        if "service_table" in data:
            service_rows = data["service_table"]
            # validate fields
            bad_rows = filter(lambda x: not x["service"] or not x["integration_key"], service_rows)
            if bad_rows:
                raise IntegrationError("Name and key are required")

            with transaction.atomic():
                exising_service_items = PagerDutyService.objects.filter(
                    organization_integration=self.org_integration
                )

                for service_item in exising_service_items:
                    # find the matching row from the input
                    matched_rows = filter(lambda x: x["id"] == service_item.id, service_rows)
                    if matched_rows:
                        matched_row = matched_rows[0]
                        service_item.integration_key = matched_row["integration_key"]
                        service_item.service_name = matched_row["service"]
                        service_item.save()
                    else:
                        service_item.delete()

                # new rows don't have an id
                new_rows = filter(lambda x: not x["id"], service_rows)
                for row in new_rows:
                    service_name = row["service"]
                    key = row["integration_key"]
                    PagerDutyService.objects.create(
                        organization_integration=self.org_integration,
                        service_name=service_name,
                        integration_key=key,
                    )

    def get_config_data(self):
        service_list = []
        for s in self.services:
            service_list.append(
                {"service": s.service_name, "integration_key": s.integration_key, "id": s.id}
            )
        return {"service_table": service_list}

    @property
    def services(self):
        services = PagerDutyService.objects.filter(organization_integration=self.org_integration)

        return services


class PagerDutyIntegrationProvider(IntegrationProvider):
    key = "pagerduty"
    name = "PagerDuty"
    metadata = metadata
    features = frozenset([IntegrationFeatures.ALERT_RULE, IntegrationFeatures.INCIDENT_MANAGEMENT])
    integration_cls = PagerDutyIntegration

    setup_dialog_config = {"width": 600, "height": 900}

    def get_pipeline_views(self):
        return [PagerDutyInstallationRedirect()]

    def post_install(self, integration, organization, extra=None):
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
                    service_name=service["name"],
                )

    def build_integration(self, state):
        config = json.loads(state.get("config"))
        account = config["account"]
        # PagerDuty gives us integration keys for various things, some of which
        # are not services. For now we only care about services.
        services = [x for x in config["integration_keys"] if x["type"] == "service"]

        return {
            "name": account["name"],
            "external_id": account["subdomain"],
            "metadata": {"services": services, "domain_name": account["subdomain"]},
        }


class PagerDutyInstallationRedirect(PipelineView):
    def get_app_url(self, account_name=None):
        if not account_name:
            account_name = "app"

        app_id = options.get("pagerduty.app-id")
        setup_url = absolute_uri("/extensions/pagerduty/setup/")

        return (
            u"https://%s.pagerduty.com/install/integration?app_id=%s&redirect_url=%s&version=2"
            % (account_name, app_id, setup_url)
        )

    def dispatch(self, request, pipeline):
        if "config" in request.GET:
            pipeline.bind_state("config", request.GET["config"])
            return pipeline.next_step()

        account_name = request.GET.get("account", None)

        return self.redirect(self.get_app_url(account_name))
