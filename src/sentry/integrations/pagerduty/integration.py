from __future__ import annotations

import logging
from collections.abc import Mapping, MutableMapping
from typing import Any, TypedDict

import orjson
from django.db import router, transaction
from django.http.request import HttpRequest
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework.fields import CharField

from sentry import options
from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationData,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.on_call.metrics import OnCallInteractionType
from sentry.integrations.pagerduty.metrics import record_event
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.types import IntegrationProviderSlug
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineSteps, PipelineView
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.utils.http import absolute_uri

from .client import PagerDutyClient
from .utils import PagerDutyServiceDict, add_service

logger = logging.getLogger("sentry.integrations.pagerduty")

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
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=PagerDuty%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/pagerduty",
    aspects={"alerts": [setup_alert]},
)


class PagerDutyOrganizationConfig(TypedDict):
    name: str
    type: str
    label: str
    help: str
    addButtonText: str
    columnLabels: dict[str, str]
    columnKeys: list[str]
    confirmDeleteMessage: str


class PagerDutyServiceConfig(TypedDict):
    service: str
    integration_key: str
    id: int


class PagerDutyIntegration(IntegrationInstallation):
    def get_keyring_client(self, keyid: int | str) -> PagerDutyClient:
        org_integration = self.org_integration
        assert org_integration, "Cannot get client without an organization integration"

        integration_key = None
        for pds in org_integration.config.get("pagerduty_services", []):
            if str(pds["id"]) == str(keyid):
                integration_key = pds["integration_key"]
        if not integration_key:
            raise ValueError("Cannot get client without an an integration_key.")

        return PagerDutyClient(
            integration_id=org_integration.integration_id, integration_key=integration_key
        )

    def get_client(self) -> None:
        raise NotImplementedError("Use get_keyring_client instead.")

    def get_organization_config(self) -> list[PagerDutyOrganizationConfig]:
        return [
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

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        if "service_table" in data:
            service_rows = data["service_table"]
            # validate fields
            bad_rows = list(
                filter(lambda x: not x["service"] or not x["integration_key"], service_rows)
            )
            if bad_rows:
                raise IntegrationError("Name and key are required")

            oi = OrganizationIntegration.objects.get(id=self.org_integration.id)
            existing_service_items: list[PagerDutyServiceDict] = oi.config.get(
                "pagerduty_services", []
            )
            updated_items: list[PagerDutyServiceDict] = []

            for service_item in existing_service_items:
                # find the matching row from the input
                matched_rows = list(filter(lambda x: x["id"] == service_item["id"], service_rows))
                if matched_rows:
                    matched_row = matched_rows[0]
                    updated_items.append(
                        {
                            "id": matched_row["id"],
                            "integration_key": matched_row["integration_key"],
                            "service_name": matched_row["service"],
                            "integration_id": service_item["integration_id"],
                        }
                    )

            with transaction.atomic(router.db_for_write(OrganizationIntegration)):
                oi.config["pagerduty_services"] = updated_items
                oi.save()

                # new rows don't have an id
                new_rows = list(filter(lambda x: not x["id"], service_rows))
                for row in new_rows:
                    service_name = row["service"]
                    key = row["integration_key"]
                    add_service(oi, integration_key=key, service_name=service_name)

    def get_config_data(self) -> Mapping[str, list[PagerDutyServiceConfig]]:
        service_list = []
        for s in self.services:
            service_list.append(
                PagerDutyServiceConfig(
                    service=s["service_name"],
                    integration_key=s["integration_key"],
                    id=s["id"],
                )
            )
        return {"service_table": service_list}

    def _get_debug_metadata_keys(self) -> list[str]:
        return ["domain_name"]

    @property
    def services(self) -> list[PagerDutyServiceDict]:
        if self.org_integration:
            return self.org_integration.config.get("pagerduty_services", [])
        return []


class PagerDutyInstallationData(TypedDict):
    config: str


class PagerDutyInstallationApiSerializer(CamelSnakeSerializer[PagerDutyInstallationData]):
    config = CharField(required=True)

    def validate_config(self, value: str) -> str:
        try:
            orjson.loads(value)
        except orjson.JSONDecodeError:
            raise serializers.ValidationError("Invalid JSON configuration data.")
        return value


class PagerDutyInstallationApiStep:
    """API-mode step for PagerDuty integration setup.

    PagerDuty uses an app install redirect flow: the user is sent to PagerDuty's
    install page, and the callback returns a JSON config param containing account
    info and integration keys.
    """

    step_name = "installation_redirect"

    def _get_app_url(self) -> str:
        app_id = options.get("pagerduty.app-id")
        setup_url = absolute_uri("/extensions/pagerduty/setup/")
        return f"https://app.pagerduty.com/install/integration?app_id={app_id}&redirect_url={setup_url}&version=2"

    def get_step_data(self, pipeline: IntegrationPipeline, request: HttpRequest) -> dict[str, str]:
        return {"installUrl": self._get_app_url()}

    def get_serializer_cls(self) -> type:
        return PagerDutyInstallationApiSerializer

    def handle_post(
        self,
        validated_data: dict[str, str],
        pipeline: IntegrationPipeline,
        request: HttpRequest,
    ) -> PipelineStepResult:
        pipeline.bind_state("config", validated_data["config"])
        return PipelineStepResult.advance()


class PagerDutyIntegrationProvider(IntegrationProvider):
    key = IntegrationProviderSlug.PAGERDUTY.value
    name = "PagerDuty"
    metadata = metadata
    features = frozenset([IntegrationFeatures.ALERT_RULE, IntegrationFeatures.INCIDENT_MANAGEMENT])
    integration_cls = PagerDutyIntegration

    setup_dialog_config = {"width": 600, "height": 900}

    def get_pipeline_views(self) -> list[PipelineView[IntegrationPipeline]]:
        return []

    def get_pipeline_api_steps(self) -> ApiPipelineSteps[IntegrationPipeline]:
        return [PagerDutyInstallationApiStep()]

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganization,
        *,
        extra: dict[str, Any],
    ) -> None:
        with record_event(OnCallInteractionType.POST_INSTALL).capture():
            services = integration.metadata["services"]
            try:
                org_integration = OrganizationIntegration.objects.get(
                    integration=integration, organization_id=organization.id
                )
            except OrganizationIntegration.DoesNotExist:
                logger.warning("The PagerDuty post_install step failed.")
                return

            with transaction.atomic(router.db_for_write(OrganizationIntegration)):
                for service in services:
                    add_service(
                        org_integration,
                        integration_key=service["integration_key"],
                        service_name=service["name"],
                    )

    def build_integration(self, state: Mapping[str, Any]) -> IntegrationData:
        config = orjson.loads(state["config"])
        account = config["account"]
        # PagerDuty gives us integration keys for various things, some of which
        # are not services. For now we only care about services.
        services = [x for x in config["integration_keys"] if x["type"] == "service"]

        return {
            "name": account["name"],
            "external_id": account["subdomain"],
            "metadata": {"services": services, "domain_name": account["subdomain"]},
        }
