from __future__ import annotations
from typing import int

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationFeatures
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pagerduty.utils import add_service
from sentry.integrations.services.integration import (
    RpcIntegration,
    RpcOrganizationIntegration,
    integration_service,
)
from sentry.integrations.services.integration.serial import (
    serialize_integration,
    serialize_organization_integration,
)
from sentry.integrations.types import EventLifecycleOutcome, ExternalProviders
from sentry.sentry_apps.models.sentry_app import SentryApp
from sentry.silo.base import SiloMode
from sentry.testutils.asserts import assert_count_of_metric, assert_failure_metric
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


class BaseIntegrationServiceTest(TestCase):
    def setUp(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.user = self.create_user()
        with assume_test_silo_mode(SiloMode.REGION):
            self.organization = self.create_organization(owner=self.user)
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration1 = self.create_integration(
                organization=self.organization,
                name="Example",
                provider="example",
                external_id="example:1",
                status=ObjectStatus.ACTIVE,
                metadata={"meta": "data"},
            )
            self.org_integration1 = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.integration1.id
            )
            self.integration2 = self.create_integration(
                organization=self.organization,
                name="Github",
                provider="github",
                external_id="github:1",
                oi_params={"config": {"oi_conf": "data"}, "status": ObjectStatus.PENDING_DELETION},
            )
            self.org_integration2 = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.integration2.id
            )
            self.integration3 = self.create_integration(
                organization=self.organization,
                name="Example",
                provider="example",
                external_id="example:2",
            )
            self.org_integration3 = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=self.integration3.id
            )
        self.integrations = [self.integration1, self.integration2, self.integration3]
        self.org_integrations = [
            self.org_integration1,
            self.org_integration2,
            self.org_integration3,
        ]

    def verify_result(
        self,
        result: list[RpcIntegration] | list[RpcOrganizationIntegration],
        expected: list[Integration] | list[OrganizationIntegration],
    ) -> None:
        """Ensures APIModels in result, match the Models in expected"""
        assert len(result) == len(expected)
        result_ids = [api_item.id for api_item in result]
        assert all([item.id in result_ids for item in expected])

    def verify_integration_result(
        self, result: RpcIntegration | None, expected: Integration
    ) -> None:
        assert result is not None
        serialized_fields = ["id", "provider", "external_id", "name", "metadata", "status"]
        for field in serialized_fields:
            assert getattr(result, field) == getattr(expected, field)

    def verify_org_integration_result(
        self,
        result: RpcIntegration | RpcOrganizationIntegration | None,
        expected: Integration | OrganizationIntegration,
    ) -> None:
        assert result is not None
        serialized_fields = [
            "id",
            "default_auth_id",
            "organization_id",
            "integration_id",
            "config",
            "status",
            "grace_period_end",
        ]
        for field in serialized_fields:
            assert getattr(result, field) == getattr(expected, field)


@all_silo_test
class IntegrationServiceTest(BaseIntegrationServiceTest):
    def test_serialize_integration(self) -> None:
        api_integration1 = serialize_integration(self.integration1)
        self.verify_integration_result(result=api_integration1, expected=self.integration1)

    def test_get_integrations(self) -> None:
        # by ids
        result = integration_service.get_integrations(
            integration_ids=[self.integration1.id, self.integration2.id]
        )
        self.verify_result(result=result, expected=[self.integration1, self.integration2])

        # by organization_id
        result = integration_service.get_integrations(organization_id=self.organization.id)
        self.verify_result(result=result, expected=self.integrations)

        # by Integration attributes
        result = integration_service.get_integrations(
            organization_id=self.organization.id, providers=["example"]
        )
        self.verify_result(result=result, expected=[self.integration1, self.integration3])

        # by OrganizationIntegration attributes
        result = integration_service.get_integrations(
            organization_id=self.organization.id,
            org_integration_status=ObjectStatus.PENDING_DELETION,
        )
        self.verify_result(result=result, expected=[self.integration2])

        # with limit
        result = integration_service.get_integrations(organization_id=self.organization.id, limit=2)
        assert len(result) == 2

        # no results
        result = integration_service.get_integrations(organization_id=-1)
        assert len(result) == 0
        result = integration_service.get_integrations()
        assert len(result) == 0

    def test_get_integration(self) -> None:
        # by id
        result = integration_service.get_integration(integration_id=self.integration3.id)
        self.verify_integration_result(result=result, expected=self.integration3)

        # by provider and external_id
        result = integration_service.get_integration(provider="example", external_id="example:1")
        self.verify_integration_result(result=result, expected=self.integration1)

        # no results
        result = integration_service.get_integration(provider="🚀")
        assert result is None
        result = integration_service.get_integration()
        assert result is None

        # non-unique result
        assert integration_service.get_integration(organization_id=self.organization.id) is None

    def test_update_integrations(self) -> None:
        new_metadata = {"new": "data"}
        integrations = [self.integration1, self.integration3]
        integration_service.update_integrations(
            integration_ids=[i.id for i in integrations], metadata=new_metadata
        )
        for i in integrations:
            original_time = i.date_updated
            assert i.metadata != new_metadata
            i.refresh_from_db()
            assert i.metadata == new_metadata
            assert original_time != i.date_updated, "date_updated should change"

    def test_get_installation(self) -> None:
        api_integration1 = serialize_integration(integration=self.integration1)
        api_install = api_integration1.get_installation(organization_id=self.organization.id)
        install = self.integration1.get_installation(organization_id=self.organization.id)
        assert api_install.org_integration is not None
        assert api_install.org_integration.id == self.org_integration1.id
        assert api_install.__class__ == install.__class__

    def test_has_feature(self) -> None:
        for feature in IntegrationFeatures:
            api_integration2 = serialize_integration(integration=self.integration2)
            integration_has_feature = self.integration2.has_feature(feature)
            api_integration_has_feature = api_integration2.has_feature(feature=feature)
            assert integration_has_feature == api_integration_has_feature


@all_silo_test
class OrganizationIntegrationServiceTest(BaseIntegrationServiceTest):
    def test_serialize_org_integration(self) -> None:
        rpc_org_integration1 = serialize_organization_integration(self.org_integration1)
        self.verify_org_integration_result(
            result=rpc_org_integration1, expected=self.org_integration1
        )

    def test_get_organization_integrations(self) -> None:
        # by ids
        result = integration_service.get_organization_integrations(
            org_integration_ids=[self.org_integration2.id, self.org_integration3.id]
        )
        self.verify_result(result=result, expected=[self.org_integration2, self.org_integration3])

        # by integration_id
        result = integration_service.get_organization_integrations(
            org_integration_ids=[self.org_integration1.id]
        )
        self.verify_result(result=result, expected=[self.org_integration1])

        # by OrganizationIntegration attributes
        result = integration_service.get_organization_integrations(
            organization_id=self.organization.id,
            status=ObjectStatus.ACTIVE,
        )
        self.verify_result(result=result, expected=[self.org_integration1, self.org_integration3])

        # by Integration attributes
        result = integration_service.get_organization_integrations(
            organization_id=self.organization.id,
            providers=["github"],
        )
        self.verify_result(result=result, expected=[self.org_integration2])

        # with limit
        result = integration_service.get_organization_integrations(
            organization_id=self.organization.id,
            limit=2,
        )
        assert len(result) == 2

        # no results
        result = integration_service.get_organization_integrations(organization_id=-1)
        assert len(result) == 0
        result = integration_service.get_organization_integrations()
        assert len(result) == 0

    def test_get_organization_integration(self) -> None:
        result = integration_service.get_organization_integration(
            integration_id=self.integration2.id,
            organization_id=self.organization.id,
        )
        self.verify_org_integration_result(result=result, expected=self.org_integration2)

        result = integration_service.get_organization_integration(
            integration_id=-1, organization_id=-1
        )
        assert result is None

    def test_get_organization_integration__pd(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            integration = self.create_integration(
                organization=self.organization,
                name=ExternalProviders.PAGERDUTY.name,
                provider=ExternalProviders.PAGERDUTY.name,
                external_id="pd:1",
                oi_params={"config": {}},
            )
            org_integration = OrganizationIntegration.objects.get(
                organization_id=self.organization.id, integration_id=integration.id
            )
            pds = add_service(
                org_integration,
                integration_key="key1",
                service_name="service1",
            )
            pds2 = add_service(
                org_integration,
                integration_key="key2",
                service_name="service1",
            )

        result = integration_service.get_organization_integration(
            integration_id=integration.id,
            organization_id=self.organization.id,
        )
        assert result
        assert result.config["pagerduty_services"] == [
            pds,
            pds2,
        ]

    def test_organization_context(self) -> None:
        new_org = self.create_organization()
        with assume_test_silo_mode(SiloMode.CONTROL):
            org_integration = self.integration3.add_organization(new_org.id)
        assert org_integration is not None

        result = integration_service.organization_context(
            organization_id=new_org.id,
            provider="example",
        )
        self.verify_integration_result(result=result.integration, expected=self.integration3)
        self.verify_org_integration_result(
            result=result.organization_integration, expected=org_integration
        )

    @freeze_time()
    def test_update_organization_integrations(self) -> None:
        now = datetime.now(timezone.utc)

        new_config = {"new": "config"}
        org_integrations = [self.org_integration1, self.org_integration3]
        integration_service.update_organization_integrations(
            org_integration_ids=[oi.id for oi in org_integrations],
            config=new_config,
            grace_period_end=now,
        )

        for oi in org_integrations:
            assert oi.config != new_config
            oi.refresh_from_db()
            assert oi.config == new_config
            assert oi.grace_period_end == now

        # Check that null fields work as well
        integration_service.update_organization_integrations(
            org_integration_ids=[oi.id for oi in org_integrations], set_grace_period_end_null=True
        )
        for oi in org_integrations:
            oi.refresh_from_db()
            assert oi.config == new_config
            assert oi.grace_period_end is None

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_incident_alert_missing_sentryapp(self, mock_record: MagicMock) -> None:
        result = integration_service.send_incident_alert_notification(
            sentry_app_id=9876,  # does not exist
            action_id=1,
            incident_id=1,
            new_status=10,
            metric_value=100,
            organization_id=self.organization.id,
            incident_attachment_json="{}",
        )
        assert not result

        # SLO asserts
        assert_failure_metric(
            mock_record, SentryApp.DoesNotExist("SentryApp matching query does not exist.")
        )

        # PREPARE_WEBHOOK (failure)
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.STARTED, outcome_count=1
        )
        assert_count_of_metric(
            mock_record=mock_record, outcome=EventLifecycleOutcome.FAILURE, outcome_count=1
        )


@all_silo_test
class StartGracePeriodForProviderTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.REGION):
            self.org1 = self.organization
            self.org2 = self.create_organization(name="Test Org 2")
            self.org3 = self.create_organization(name="Test Org 3")

        with assume_test_silo_mode(SiloMode.CONTROL):

            self.github_integration_1 = self.create_integration(
                organization=self.org2,
                name="GitHub Integration 1",
                provider="github",
                external_id="github:repo1",
                status=ObjectStatus.ACTIVE,
            )

            self.github_integration_2 = self.create_integration(
                organization=self.org1,
                name="GitHub Integration 2",
                provider="github",
                external_id="github:repo2",
                status=ObjectStatus.ACTIVE,
            )

            now = datetime.now(timezone.utc)
            # Add the same GitHub integrations to other orgs (multi-org scenario)
            # Org2 uses github_integration_1 and is older than org1's so org1 should get the grace period
            self.org1_github_oi_1 = self.create_organization_integration(
                integration=self.github_integration_1,
                organization_id=self.org1.id,
                status=ObjectStatus.ACTIVE,
                date_added=now,  # Older than org 2
            )

            # Org3 uses github_integration_2 and is newer than org1's
            self.org3_github_oi_2 = self.create_organization_integration(
                integration=self.github_integration_2,
                organization_id=self.org3.id,
                status=ObjectStatus.ACTIVE,
                date_added=now + timedelta(days=5),  # Newer than org1
            )

            # Get org2's OrganizationIntegration for github_integration_1
            self.org2_github_oi_1 = OrganizationIntegration.objects.get(
                organization_id=self.org2.id, integration_id=self.github_integration_1.id
            )
            # Get org1's OrganizationIntegration for github_integration_2
            self.org1_github_oi_2 = OrganizationIntegration.objects.get(
                organization_id=self.org1.id, integration_id=self.github_integration_2.id
            )

    @freeze_time()
    def test_start_grace_period_for_provider_github_with_skip_oldest(self) -> None:
        grace_period_end = datetime.now(timezone.utc) + timedelta(days=7)
        with assume_test_silo_mode(SiloMode.REGION):
            grace_perioded_ois = integration_service.start_grace_period_for_provider(
                organization_id=self.org1.id,
                provider="github",
                grace_period_end=grace_period_end,
                status=ObjectStatus.ACTIVE,
                skip_oldest=True,
            )

        # Expected behavior with skip_oldest=True:
        # - org1_github_oi_1 should get grace perioded since org 2's OI is older
        # - org1_github_oi_2 should not get grace perioded (since it's the oldest OI for this integration)
        # - org3_github_oi_2 should not get grace perioded (OIs that aren't from the downgrading org should be untouched)

        lof_grace_perioded_ois = [oi.id for oi in grace_perioded_ois]

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org1_github_oi_1.refresh_from_db()
            self.org1_github_oi_2.refresh_from_db()
            self.org3_github_oi_2.refresh_from_db()
            self.org2_github_oi_1.refresh_from_db()

        # Assertions for github_integration_1
        assert self.org1_github_oi_1.id in lof_grace_perioded_ois
        assert self.org1_github_oi_1.grace_period_end == grace_period_end
        assert self.org2_github_oi_1.grace_period_end is None
        assert self.org2_github_oi_1.id not in lof_grace_perioded_ois

        # Assertions for github_integration_2
        assert self.org1_github_oi_2.id not in lof_grace_perioded_ois
        assert self.org1_github_oi_2.grace_period_end is None
        assert self.org3_github_oi_2.id not in lof_grace_perioded_ois
        assert self.org3_github_oi_2.grace_period_end is None

        assert len(lof_grace_perioded_ois) == 1, "Should only include org1_github_oi_1"

    def test_start_grace_period_for_provider_github_without_skip_oldest(self) -> None:
        grace_period_end = datetime.now(timezone.utc) + timedelta(days=7)

        grace_perioded_ois = integration_service.start_grace_period_for_provider(
            organization_id=self.org1.id,
            provider="github",
            grace_period_end=grace_period_end,
            status=ObjectStatus.ACTIVE,
            skip_oldest=False,
        )

        # Expected behavior with skip_oldest=False:
        # - Both org1's GitHub OrganizationIntegrations should get grace perioded
        # - Other orgs' OIs should NOT be included

        lof_grace_perioded_ois = [oi.id for oi in grace_perioded_ois]

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org1_github_oi_1.refresh_from_db()
            self.org1_github_oi_2.refresh_from_db()

            ois_grace_perioded = OrganizationIntegration.objects.filter(
                organization_id=self.org1.id,
                grace_period_end__isnull=False,
            )

        for oi in ois_grace_perioded:
            assert oi.id in lof_grace_perioded_ois
            assert oi.grace_period_end == grace_period_end

        assert self.org1_github_oi_1.id in lof_grace_perioded_ois
        assert self.org1_github_oi_2.id in lof_grace_perioded_ois
        assert self.org1_github_oi_1.grace_period_end == grace_period_end
        assert self.org1_github_oi_2.grace_period_end == grace_period_end

        assert len(lof_grace_perioded_ois) == 2, "Both org1's GitHub OIs should be grace perioded"

    def test_start_grace_period_for_provider_github_for_all_statuses(self) -> None:
        grace_period_end = datetime.now(timezone.utc) + timedelta(days=7)
        self.github_integration_3 = self.create_integration(
            organization=self.org1,
            name="GitHub Integration 3",
            provider="github",
            external_id="github:repo3",
            status=None,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org1_github_oi_3 = OrganizationIntegration.objects.get(
                organization_id=self.org1.id, integration_id=self.github_integration_3.id
            )
            self.org1_github_oi_3.status = ObjectStatus.HIDDEN
            self.org1_github_oi_3.save()

        grace_perioded_ois = integration_service.start_grace_period_for_provider(
            organization_id=self.org1.id,
            provider="github",
            grace_period_end=grace_period_end,
            status=None,
            skip_oldest=False,
        )

        # Expected behavior with skip_oldest=False:
        # - Both org1's GitHub OrganizationIntegrations should get grace perioded
        # - Other orgs' OIs should NOT be included

        lof_grace_perioded_ois = [oi.id for oi in grace_perioded_ois]

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org1_github_oi_1.refresh_from_db()
            self.org1_github_oi_2.refresh_from_db()
            self.org1_github_oi_3.refresh_from_db()

            ois_grace_perioded = OrganizationIntegration.objects.filter(
                organization_id=self.org1.id,
                grace_period_end__isnull=False,
            )

        for oi in ois_grace_perioded:
            assert oi.id in lof_grace_perioded_ois
            assert oi.grace_period_end == grace_period_end

        assert len(lof_grace_perioded_ois) == 3, "All org1's GitHub OIs should be grace perioded"

    def test_start_grace_period_for_provider_github_for_all_statuses_with_skip_oldest(self) -> None:
        grace_period_end = datetime.now(timezone.utc) + timedelta(days=7)
        self.github_integration_3 = self.create_integration(
            organization=self.org1,
            name="GitHub Integration 3",
            provider="github",
            external_id="github:repo3",
            status=None,
        )
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org1_github_oi_3 = OrganizationIntegration.objects.get(
                organization_id=self.org1.id, integration_id=self.github_integration_3.id
            )
            self.org1_github_oi_3.status = ObjectStatus.HIDDEN
            self.org1_github_oi_3.save()

        grace_perioded_ois = integration_service.start_grace_period_for_provider(
            organization_id=self.org1.id,
            provider="github",
            grace_period_end=grace_period_end,
            status=None,
            skip_oldest=True,
        )

        # Expected behavior with skip_oldest=False:
        # - Both org1's GitHub OrganizationIntegrations should get grace perioded
        # - Other orgs' OIs should NOT be included

        lof_grace_perioded_ois = [oi.id for oi in grace_perioded_ois]

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.org1_github_oi_1.refresh_from_db()
            self.org1_github_oi_2.refresh_from_db()
            self.org1_github_oi_3.refresh_from_db()
            ois_grace_perioded = OrganizationIntegration.objects.filter(
                organization_id=self.org1.id,
                grace_period_end__isnull=False,
            )

        for oi in ois_grace_perioded:
            assert oi.id in lof_grace_perioded_ois
            assert oi.grace_period_end == grace_period_end

        assert (
            len(lof_grace_perioded_ois) == 1
        ), "Only org1_github_oi_1 should be grace perioded since it's NOT the oldest OI for its integration"

        assert self.org1_github_oi_1.id in lof_grace_perioded_ois
        assert self.org1_github_oi_1.grace_period_end == grace_period_end
        assert self.org1_github_oi_2.id not in lof_grace_perioded_ois
        assert self.org1_github_oi_2.grace_period_end is None
        assert self.org1_github_oi_3.id not in lof_grace_perioded_ois
        assert self.org1_github_oi_3.grace_period_end is None
