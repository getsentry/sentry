from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.messages.storage.fallback import FallbackStorage
from django.contrib.sessions.backends.base import SessionBase
from django.test import RequestFactory

import sentry.identity
from sentry.identity.pipeline import IdentityPipeline, MonitoringIdentityPipeline
from sentry.identity.providers.dummy import DummyProvider
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.users.models.identity import Identity, IdentityProvider, OrganizationIdentity

DUMMY_IDENTITY_DATA = {
    "type": "dummy",
    "id": "user-123",
    "idp_external_id": "org-456",
    "idp_config": {"site": "example.com"},
    "email": "user@example.com",
    "name": "Test User",
    "scopes": [],
    "data": {"access_token": "token"},
}


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class IdentityPipelineFinishTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = self._make_request()

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    def _make_request(self) -> Any:
        request = RequestFactory().get("/")
        request.session = SessionBase()
        request.user = self.user
        request.subdomain = None
        setattr(request, "_messages", FallbackStorage(request))
        return request

    @patch.object(DummyProvider, "build_identity", return_value=DUMMY_IDENTITY_DATA)
    def test_no_auto_create_with_provider_model_links_identity(
        self, mock_build: MagicMock, mock_record: MagicMock
    ) -> None:
        existing_idp = IdentityProvider.objects.create(
            type="dummy", external_id="org-456", config={"site": "example.com"}
        )

        pipeline = IdentityPipeline(
            request=self.request,
            provider_key="dummy",
            provider_model=existing_idp,
        )
        pipeline.initialize()

        pipeline.finish_pipeline()

        assert IdentityProvider.objects.filter(type="dummy").count() == 1
        identity = Identity.objects.get(idp=existing_idp, user=self.user)
        assert identity.external_id == "user-123"
        assert identity.data["access_token"] == "token"

    @patch.object(DummyProvider, "build_identity", return_value=DUMMY_IDENTITY_DATA)
    def test_no_auto_create_without_provider_model_raises(
        self, mock_build: MagicMock, mock_record: MagicMock
    ) -> None:
        pipeline = IdentityPipeline(
            request=self.request,
            provider_key="dummy",
            provider_model=None,
        )
        pipeline.initialize()

        with pytest.raises(AssertionError):
            pipeline.finish_pipeline()

    @patch.object(DummyProvider, "auto_create_provider_model", True)
    @patch.object(DummyProvider, "build_identity", return_value=DUMMY_IDENTITY_DATA)
    def test_auto_creates_identity_provider(
        self, mock_build: MagicMock, mock_record: MagicMock
    ) -> None:
        pipeline = IdentityPipeline(request=self.request, provider_key="dummy", provider_model=None)
        pipeline.initialize()

        pipeline.finish_pipeline()

        idp = IdentityProvider.objects.get(type="dummy", external_id="org-456")
        assert idp.config == {"site": "example.com"}

        identity = Identity.objects.get(idp=idp, user=self.user)
        assert identity.external_id == "user-123"
        assert identity.data["access_token"] == "token"

    @patch.object(DummyProvider, "auto_create_provider_model", True)
    @patch.object(DummyProvider, "build_identity", return_value=DUMMY_IDENTITY_DATA)
    def test_auto_create_preserves_existing_identity_provider(
        self, mock_build: MagicMock, mock_record: MagicMock
    ) -> None:
        existing_idp = IdentityProvider.objects.create(
            type="dummy", external_id="org-456", config={"site": "old.example.com"}
        )

        pipeline = IdentityPipeline(request=self.request, provider_key="dummy", provider_model=None)
        pipeline.initialize()

        pipeline.finish_pipeline()

        assert IdentityProvider.objects.filter(type="dummy").count() == 1
        existing_idp.refresh_from_db()
        assert existing_idp.config == {"site": "old.example.com"}

        identity = Identity.objects.get(idp=existing_idp, user=self.user)
        assert identity.external_id == "user-123"


@control_silo_test
@patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
class MonitoringIdentityPipelineFinishTest(TestCase):
    def setUp(self) -> None:
        sentry.identity.register(DummyProvider)
        super().setUp()
        self.request = self._make_request()

    def tearDown(self) -> None:
        super().tearDown()
        sentry.identity.unregister(DummyProvider)

    def _make_request(self) -> Any:
        request = RequestFactory().get("/")
        request.session = SessionBase()
        request.user = self.user
        request.subdomain = None
        setattr(request, "_messages", FallbackStorage(request))
        return request

    @patch.object(DummyProvider, "build_identity", return_value=DUMMY_IDENTITY_DATA)
    def test_creates_organization_identity(
        self, mock_build: MagicMock, mock_record: MagicMock
    ) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            rpc_org = serialize_rpc_organization(self.organization)

        idp = IdentityProvider.objects.create(
            type="dummy", external_id="org-456", config={"site": "example.com"}
        )

        pipeline = MonitoringIdentityPipeline(
            request=self.request,
            provider_key="dummy",
            organization=rpc_org,
            provider_model=idp,
        )
        pipeline.initialize()

        pipeline.finish_pipeline()

        identity = Identity.objects.get(idp=idp, user=self.user)
        assert OrganizationIdentity.objects.filter(
            organization_id=self.organization.id,
            identity=identity,
        ).exists()

    @patch.object(DummyProvider, "build_identity", return_value=DUMMY_IDENTITY_DATA)
    def test_no_organization_skips_organization_identity(
        self, mock_build: MagicMock, mock_record: MagicMock
    ) -> None:
        idp = IdentityProvider.objects.create(
            type="dummy", external_id="org-456", config={"site": "example.com"}
        )

        pipeline = MonitoringIdentityPipeline(
            request=self.request,
            provider_key="dummy",
            organization=None,
            provider_model=idp,
        )
        pipeline.initialize()

        pipeline.finish_pipeline()

        identity = Identity.objects.get(idp=idp, user=self.user)
        assert not OrganizationIdentity.objects.filter(identity=identity).exists()
