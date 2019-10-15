from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _
from django.db import transaction

from sentry import options

from sentry.utils import json
from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
    FeatureDescription,
)
from sentry.models import OrganizationIntegration, PagerDutyServiceProject, PagerDutyService, Project
from sentry.pipeline import PipelineView

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
    def get_client(self):
        pass

    def get_organization_config(self):
        from sentry.models import Project

        projects = Project.objects.filter(
            organization_id=self.org_integration.organization_id,
        )
        items = []
        for p in projects:
            items.append({"value": p.id, "label": p.name})

        service_options = [(s.id, s.service_name,) for s in self.services]

        fields = [
            {
                "name": "project_mapping",
                "type": "choice_mapper",
                "label": "Map projects in Sentry to services in PagerDuty",
                "help": "When an alert rule is triggered in a project, this mapping will let us know what service to create the incident in PagerDuty.",
                "addButtonText": "Add Sentry Project",
                "addDropdown": {
                    "emptyMessage": "All projects configured",
                    "noResultsMessage": "Could not find project",
                    "items": items,
                },
                "mappedSelectors": {
                    "service": {
                        "choices": service_options,
                        "placeholder": "Select a service",
                    }
                },
                "columnLabels": {"service": "Service"},
                "mappedColumnLabel": "Sentry Project",
            }
        ]

        return fields

    def update_organization_config(self, data):

        if "project_mapping" in data:
            project_ids_and_services = data.pop("project_mapping")

            with transaction.atomic():
                PagerDutyServiceProject.objects.filter(
                    pagerduty_service__in=PagerDutyService.objects.filter(organization_integration=self.org_integration),
                ).delete()

                for p_id, s in project_ids_and_services.items():
                    # create the record in the table
                    project = Project.objects.get(pk=p_id)
                    service = PagerDutyService.objects.get(id=s["service"])
                    PagerDutyServiceProject.objects.create(
                        project=project,
                        pagerduty_service=service,
                    )

    def get_config_data(self):
        config = self.org_integration.config
        project_mappings = PagerDutyServiceProject.objects.filter(
            pagerduty_service__in=PagerDutyService.objects.filter(
                organization_integration_id=self.org_integration.id,
            ),
        )
        data = {}
        for pm in project_mappings:
            data[pm.project_id] = {
                "service": pm.pagerduty_service.id,
            }
        config = {}
        config["project_mapping"] = data
        return config

    @property
    def services(self):
        services = PagerDutyService.objects.filter(
            organization_integration=self.org_integration,
        )

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
                integration=integration,
                organization=organization,
            )
        except OrganizationIntegration.DoesNotExist:
            return

        with transaction.atomic():
            for service in services:
                PagerDutyService.objects.create(
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
        services = filter(lambda x: x['type'] == 'service', config['integration_keys'])

        return {
            "name": account["name"],
            "external_id": account["subdomain"],
            "metadata": {"services": services},
        }


class PagerDutyInstallationRedirect(PipelineView):
    def get_app_url(self):
        app_id = options.get("pagerduty.app-id")
        setup_url = "https://meredith.ngrok.io/extensions/pagerduty/setup/"

        return "https://app.pagerduty.com/install/integration?app_id=%s&redirect_url=%s&version=1" % (app_id, setup_url)

    def dispatch(self, request, pipeline):
        if "config" in request.GET:
            pipeline.bind_state("config", request.GET["config"])
            return pipeline.next_step()

        return self.redirect(self.get_app_url())
