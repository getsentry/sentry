from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from freezegun import freeze_time

from sentry.constants import ObjectStatus
from sentry.integrations.base import IntegrationFeatures
from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.integration import (
    RpcIntegration,
    RpcOrganizationIntegration,
    integration_service,
)
from sentry.testutils import TestCase
from sentry.testutils.silo import all_silo_test, exempt_from_silo_limits


class BaseIntegrationServiceTest(TestCase):
    @exempt_from_silo_limits()
    def setUp(self):
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
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
        result: List[RpcIntegration | RpcOrganizationIntegration],
        expected: List[Integration | OrganizationIntegration],
    ):
        """Ensures APIModels in result, match the Models in expected"""
        assert len(result) == len(expected)
        result_ids = [api_item.id for api_item in result]
        assert all([item.id in result_ids for item in expected])

    def verify_integration_result(self, result: RpcIntegration, expected: Integration):
        serialized_fields = ["id", "provider", "external_id", "name", "metadata", "status"]
        for field in serialized_fields:
            assert getattr(result, field) == getattr(expected, field)

    def verify_org_integration_result(self, result: RpcIntegration, expected: Integration):
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


@all_silo_test(stable=True)
class IntegrationServiceTest(BaseIntegrationServiceTest):
    def test_serialize_integration(self):
        api_integration1 = integration_service._serialize_integration(self.integration1)
        self.verify_integration_result(result=api_integration1, expected=self.integration1)

    def test_get_integrations(self):
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

    def test_get_integration(self):
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

    def test_update_integrations(self):
        new_metadata = {"new": "data"}
        integrations = [self.integration1, self.integration3]
        integration_service.update_integrations(
            integration_ids=[i.id for i in integrations], metadata=new_metadata
        )
        for i in integrations:
            assert i.metadata != new_metadata
            i.refresh_from_db()
            assert i.metadata == new_metadata

    def test_get_installation(self):
        api_integration1 = integration_service._serialize_integration(integration=self.integration1)
        api_install = integration_service.get_installation(
            integration=api_integration1, organization_id=self.organization.id
        )
        install = self.integration1.get_installation(organization_id=self.organization.id)
        assert api_install.org_integration.id == self.org_integration1.id
        assert api_install.__class__ == install.__class__

    def test_has_feature(self):
        for feature in IntegrationFeatures:
            api_integration2 = integration_service._serialize_integration(
                integration=self.integration2
            )
            integration_has_feature = self.integration2.has_feature(feature)
            api_integration_has_feature = integration_service.has_feature(
                provider=api_integration2.provider, feature=feature
            )
            assert integration_has_feature == api_integration_has_feature


@all_silo_test(stable=True)
class OrganizationIntegrationServiceTest(BaseIntegrationServiceTest):
    def test_serialize_org_integration(self):
        rpc_org_integration1 = integration_service._serialize_organization_integration(
            self.org_integration1
        )
        self.verify_org_integration_result(
            result=rpc_org_integration1, expected=self.org_integration1
        )

    def test_get_organization_integrations(self):
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

    def test_get_organization_integration(self):
        result = integration_service.get_organization_integration(
            integration_id=self.integration2.id,
            organization_id=self.organization.id,
        )
        self.verify_org_integration_result(result=result, expected=self.org_integration2)

        result = integration_service.get_organization_integration(
            integration_id=-1, organization_id=-1
        )
        assert result is None

    def test_get_organization_context(self):
        new_org = self.create_organization()
        with exempt_from_silo_limits():
            org_integration = self.integration3.add_organization(new_org)

        result_integration, result_org_integration = integration_service.get_organization_context(
            organization_id=new_org.id,
            provider="example",
        )
        self.verify_integration_result(result=result_integration, expected=self.integration3)
        self.verify_org_integration_result(result=result_org_integration, expected=org_integration)

    @freeze_time()
    def test_update_organization_integrations(self):
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
