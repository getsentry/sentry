from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import quote, urlencode

import pytest
import responses
from django.urls import reverse

from sentry.integrations.bitbucket.integration import BitbucketIntegrationProvider
from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.utils.atlassian_connect import AtlassianConnectValidationError
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class BitbucketIntegrationTest(APITestCase):
    provider = BitbucketIntegrationProvider

    def setUp(self) -> None:
        self.base_url = "https://api.bitbucket.org"
        self.shared_secret = "234567890"
        self.subject = "connect:1234567"
        self.integration = self.create_provider_integration(
            provider=self.provider.key,
            external_id=self.subject,
            name="sentryuser",
            metadata={
                "base_url": self.base_url,
                "domain_name": "bitbucket.org/Test-Organization",
                "shared_secret": self.shared_secret,
                "subject": self.subject,
            },
        )
        self.login_as(self.user)
        self.integration.add_organization(self.organization, self.user)
        self.path = reverse(
            "sentry-extensions-bitbucket-search", args=[self.organization.slug, self.integration.id]
        )

    @responses.activate
    def test_get_repositories_with_uuid(self) -> None:
        uuid = "{a21bd75c-0ce2-402d-b70b-e57de6fba4b3}"
        self.integration.metadata["uuid"] = uuid
        url = f"https://api.bitbucket.org/2.0/repositories/{quote(uuid)}"
        responses.add(
            responses.GET,
            url,
            json={"values": [{"full_name": "sentryuser/stuf", "uuid": "{abc-001}"}]},
        )
        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories()
        assert result == [
            {"identifier": "sentryuser/stuf", "name": "sentryuser/stuf", "external_id": "{abc-001}"}
        ]

    @responses.activate
    def test_get_repositories_multiple_pages(self) -> None:
        """get_repos aggregates all pages by following the 'next' URL."""
        base_url = "https://api.bitbucket.org/2.0/repositories/sentryuser"
        responses.add(
            responses.GET,
            base_url,
            json={
                "values": [{"full_name": "sentryuser/repo-1", "uuid": "{r1}"}],
                "next": f"{base_url}?pagelen=100&page=2",
            },
        )
        responses.add(
            responses.GET,
            f"{base_url}?pagelen=100&page=2",
            json={
                "values": [{"full_name": "sentryuser/repo-2", "uuid": "{r2}"}],
                "next": f"{base_url}?pagelen=100&page=3",
            },
        )
        responses.add(
            responses.GET,
            f"{base_url}?pagelen=100&page=3",
            json={"values": [{"full_name": "sentryuser/repo-3", "uuid": "{r3}"}]},
        )

        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories()
        assert result == [
            {"identifier": "sentryuser/repo-1", "name": "sentryuser/repo-1", "external_id": "{r1}"},
            {"identifier": "sentryuser/repo-2", "name": "sentryuser/repo-2", "external_id": "{r2}"},
            {"identifier": "sentryuser/repo-3", "name": "sentryuser/repo-3", "external_id": "{r3}"},
        ]

    @responses.activate
    def test_get_repositories_respects_page_limit(self) -> None:
        """Pagination stops at the page_number_limit."""
        base_url = "https://api.bitbucket.org/2.0/repositories/sentryuser"
        # Page 1 has a next link but we pass page_number_limit=1
        responses.add(
            responses.GET,
            base_url,
            json={
                "values": [{"full_name": "sentryuser/repo-1", "uuid": "{r1}"}],
                "next": f"{base_url}?pagelen=100&page=2",
            },
        )
        # Page 2 should not be fetched
        responses.add(
            responses.GET,
            f"{base_url}?pagelen=100&page=2",
            json={"values": [{"full_name": "sentryuser/repo-2", "uuid": "{r2}"}]},
        )

        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories(page_number_limit=1)
        assert result == [
            {"identifier": "sentryuser/repo-1", "name": "sentryuser/repo-1", "external_id": "{r1}"},
        ]
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_repositories_zero_page_limit_returns_first_page(self) -> None:
        """A page_number_limit of 0 still returns the first page but fetches no further."""
        base_url = "https://api.bitbucket.org/2.0/repositories/sentryuser"
        responses.add(
            responses.GET,
            base_url,
            json={
                "values": [{"full_name": "sentryuser/repo-1", "uuid": "{r1}"}],
                "next": f"{base_url}?pagelen=100&page=2",
            },
        )
        responses.add(
            responses.GET,
            f"{base_url}?pagelen=100&page=2",
            json={"values": [{"full_name": "sentryuser/repo-2", "uuid": "{r2}"}]},
        )

        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories(page_number_limit=0)
        assert result == [
            {"identifier": "sentryuser/repo-1", "name": "sentryuser/repo-1", "external_id": "{r1}"},
        ]
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_repositories_clamps_excessive_page_limit(self) -> None:
        """A page_number_limit above the class max is clamped to the default."""
        base_url = "https://api.bitbucket.org/2.0/repositories/sentryuser"
        responses.add(
            responses.GET,
            base_url,
            json={"values": [{"full_name": "sentryuser/repo-1", "uuid": "{r1}"}]},
        )

        installation = self.integration.get_installation(self.organization.id)
        client = installation.get_client()
        result = installation.get_repositories(page_number_limit=client.page_number_limit + 100)
        assert result == [
            {"identifier": "sentryuser/repo-1", "name": "sentryuser/repo-1", "external_id": "{r1}"},
        ]
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_repositories_exact_match(self) -> None:
        querystring = urlencode({"q": 'name="stuf"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={"values": [{"full_name": "sentryuser/stuf", "uuid": "{abc-001}"}]},
        )

        querystring = urlencode({"q": 'name~"stuf"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={
                "values": [
                    {"full_name": "sentryuser/stuff", "uuid": "{abc-002}"},
                    {"full_name": "sentryuser/stuff-2010", "uuid": "{abc-003}"},
                    {"full_name": "sentryuser/stuff-2011", "uuid": "{abc-004}"},
                    {"full_name": "sentryuser/stuff-2012", "uuid": "{abc-005}"},
                    {"full_name": "sentryuser/stuff-2013", "uuid": "{abc-006}"},
                    {"full_name": "sentryuser/stuff-2014", "uuid": "{abc-007}"},
                    {"full_name": "sentryuser/stuff-2015", "uuid": "{abc-008}"},
                    {"full_name": "sentryuser/stuff-2016", "uuid": "{abc-009}"},
                    {"full_name": "sentryuser/stuff-2016", "uuid": "{abc-009}"},
                    {"full_name": "sentryuser/stuff-2017", "uuid": "{abc-010}"},
                    {"full_name": "sentryuser/stuff-2018", "uuid": "{abc-011}"},
                    {"full_name": "sentryuser/stuff-2019", "uuid": "{abc-012}"},
                ]
            },
        )

        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories("stuf")
        assert result == [
            {
                "identifier": "sentryuser/stuf",
                "name": "sentryuser/stuf",
                "external_id": "{abc-001}",
            },
            {
                "identifier": "sentryuser/stuff",
                "name": "sentryuser/stuff",
                "external_id": "{abc-002}",
            },
            {
                "identifier": "sentryuser/stuff-2010",
                "name": "sentryuser/stuff-2010",
                "external_id": "{abc-003}",
            },
            {
                "identifier": "sentryuser/stuff-2011",
                "name": "sentryuser/stuff-2011",
                "external_id": "{abc-004}",
            },
            {
                "identifier": "sentryuser/stuff-2012",
                "name": "sentryuser/stuff-2012",
                "external_id": "{abc-005}",
            },
            {
                "identifier": "sentryuser/stuff-2013",
                "name": "sentryuser/stuff-2013",
                "external_id": "{abc-006}",
            },
            {
                "identifier": "sentryuser/stuff-2014",
                "name": "sentryuser/stuff-2014",
                "external_id": "{abc-007}",
            },
            {
                "identifier": "sentryuser/stuff-2015",
                "name": "sentryuser/stuff-2015",
                "external_id": "{abc-008}",
            },
            {
                "identifier": "sentryuser/stuff-2016",
                "name": "sentryuser/stuff-2016",
                "external_id": "{abc-009}",
            },
            {
                "identifier": "sentryuser/stuff-2017",
                "name": "sentryuser/stuff-2017",
                "external_id": "{abc-010}",
            },
            {
                "identifier": "sentryuser/stuff-2018",
                "name": "sentryuser/stuff-2018",
                "external_id": "{abc-011}",
            },
            {
                "identifier": "sentryuser/stuff-2019",
                "name": "sentryuser/stuff-2019",
                "external_id": "{abc-012}",
            },
        ]

    @responses.activate
    def test_get_repositories_no_exact_match(self) -> None:
        querystring = urlencode({"q": 'name~"stu"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={
                "values": [
                    {"full_name": "sentryuser/stuff", "uuid": "{abc-002}"},
                    {"full_name": "sentryuser/stuff-2010", "uuid": "{abc-003}"},
                    {"full_name": "sentryuser/stuff-2011", "uuid": "{abc-004}"},
                    {"full_name": "sentryuser/stuff-2012", "uuid": "{abc-005}"},
                    {"full_name": "sentryuser/stuff-2013", "uuid": "{abc-006}"},
                    {"full_name": "sentryuser/stuff-2014", "uuid": "{abc-007}"},
                    {"full_name": "sentryuser/stuff-2015", "uuid": "{abc-008}"},
                    {"full_name": "sentryuser/stuff-2016", "uuid": "{abc-009}"},
                    {"full_name": "sentryuser/stuff-2016", "uuid": "{abc-009}"},
                    {"full_name": "sentryuser/stuff-2017", "uuid": "{abc-010}"},
                    {"full_name": "sentryuser/stuff-2018", "uuid": "{abc-011}"},
                    {"full_name": "sentryuser/stuff-2019", "uuid": "{abc-012}"},
                ]
            },
        )

        querystring = urlencode({"q": 'name="stu"'})
        responses.add(
            responses.GET,
            f"https://api.bitbucket.org/2.0/repositories/sentryuser?{querystring}",
            json={"values": []},
        )

        installation = self.integration.get_installation(self.organization.id)
        result = installation.get_repositories("stu")
        assert result == [
            {
                "identifier": "sentryuser/stuff",
                "name": "sentryuser/stuff",
                "external_id": "{abc-002}",
            },
            {
                "identifier": "sentryuser/stuff-2010",
                "name": "sentryuser/stuff-2010",
                "external_id": "{abc-003}",
            },
            {
                "identifier": "sentryuser/stuff-2011",
                "name": "sentryuser/stuff-2011",
                "external_id": "{abc-004}",
            },
            {
                "identifier": "sentryuser/stuff-2012",
                "name": "sentryuser/stuff-2012",
                "external_id": "{abc-005}",
            },
            {
                "identifier": "sentryuser/stuff-2013",
                "name": "sentryuser/stuff-2013",
                "external_id": "{abc-006}",
            },
            {
                "identifier": "sentryuser/stuff-2014",
                "name": "sentryuser/stuff-2014",
                "external_id": "{abc-007}",
            },
            {
                "identifier": "sentryuser/stuff-2015",
                "name": "sentryuser/stuff-2015",
                "external_id": "{abc-008}",
            },
            {
                "identifier": "sentryuser/stuff-2016",
                "name": "sentryuser/stuff-2016",
                "external_id": "{abc-009}",
            },
            {
                "identifier": "sentryuser/stuff-2017",
                "name": "sentryuser/stuff-2017",
                "external_id": "{abc-010}",
            },
            {
                "identifier": "sentryuser/stuff-2018",
                "name": "sentryuser/stuff-2018",
                "external_id": "{abc-011}",
            },
            {
                "identifier": "sentryuser/stuff-2019",
                "name": "sentryuser/stuff-2019",
                "external_id": "{abc-012}",
            },
        ]

    @responses.activate
    def test_source_url_matches(self) -> None:
        installation = self.integration.get_installation(self.organization.id)

        test_cases = [
            (
                "https://bitbucket.org/Test-Organization/sentry/src/master/src/sentry/integrations/bitbucket/integration.py",
                True,
            ),
            (
                "https://notbitbucket.org/Test-Organization/sentry/src/master/src/sentry/integrations/bitbucket/integration.py",
                False,
            ),
            ("https://jianyuan.io", False),
        ]
        for source_url, matches in test_cases:
            assert installation.source_url_matches(source_url) == matches

    @responses.activate
    def test_extract_branch_from_source_url(self) -> None:
        installation = self.integration.get_installation(self.organization.id)
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/repo",
                url="https://bitbucket.org/Test-Organization/repo",
                provider="integrations:bitbucket",
                external_id=123,
                config={"name": "Test-Organization/repo"},
                integration_id=integration.id,
            )
        source_url = "https://bitbucket.org/Test-Organization/repo/src/master/src/sentry/integrations/bitbucket/integration.py"

        assert installation.extract_branch_from_source_url(repo, source_url) == "master"

    @responses.activate
    def test_extract_source_path_from_source_url(self) -> None:
        installation = self.integration.get_installation(self.organization.id)
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/repo",
                url="https://bitbucket.org/Test-Organization/repo",
                provider="integrations:bitbucket",
                external_id=123,
                config={"name": "Test-Organization/repo"},
                integration_id=integration.id,
            )
        source_url = "https://bitbucket.org/Test-Organization/repo/src/master/src/sentry/integrations/bitbucket/integration.py"

        assert (
            installation.extract_source_path_from_source_url(repo, source_url)
            == "src/sentry/integrations/bitbucket/integration.py"
        )

    @responses.activate
    def test_extract_source_path_from_source_url_strips_query_params(self) -> None:
        installation = self.integration.get_installation(self.organization.id)
        integration = Integration.objects.get(provider=self.provider.key)

        with assume_test_silo_mode(SiloMode.CELL):
            repo = Repository.objects.create(
                organization_id=self.organization.id,
                name="Test-Organization/repo",
                url="https://bitbucket.org/Test-Organization/repo",
                provider="integrations:bitbucket",
                external_id=123,
                config={"name": "Test-Organization/repo"},
                integration_id=integration.id,
            )
        source_url = "https://bitbucket.org/Test-Organization/repo/src/master/src/sentry/integrations/bitbucket/integration.py?at=master"

        assert (
            installation.extract_source_path_from_source_url(repo, source_url)
            == "src/sentry/integrations/bitbucket/integration.py"
        )

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_get_repository_choices_halt_lifecycle(
        self, mock_record_halt: MagicMock, mock_record_failure: MagicMock
    ) -> None:
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser",
            status=404,
            json={"error": {"message": "No workspace with identifier sentryuser"}},
        )
        installation = self.integration.get_installation(self.organization.id)
        with pytest.raises(
            IntegrationError, match="Unable to retrieve repositories. Please try again later."
        ):
            installation.get_repository_choices(None, {})
        assert mock_record_halt.call_count == 1
        assert mock_record_failure.call_count == 0

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_failure")
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_halt")
    def test_get_repository_choices_failure_lifecycle(
        self, mock_record_halt: MagicMock, mock_record_failure: MagicMock
    ) -> None:
        responses.add(
            responses.GET,
            "https://api.bitbucket.org/2.0/repositories/sentryuser",
            status=404,
            json={"error": {"message": "Some other error, sentry is responsible"}},
        )
        installation = self.integration.get_installation(self.organization.id)
        with pytest.raises(
            IntegrationError, match="Unable to retrieve repositories. Please try again later."
        ):
            installation.get_repository_choices(None, {})
        assert mock_record_halt.call_count == 0
        assert mock_record_failure.call_count == 1


@control_silo_test
class BitbucketApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.subject = "connect:1234567"
        self.shared_secret = "234567890"
        self.integration = self.create_provider_integration(
            provider="bitbucket",
            external_id=self.subject,
            name="sentryuser",
            metadata={
                "base_url": "https://api.bitbucket.org",
                "shared_secret": self.shared_secret,
            },
        )

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self) -> Any:
        return self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "bitbucket"},
            format="json",
        )

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    @responses.activate
    def test_initialize_pipeline(self) -> None:
        resp = self._initialize_pipeline()
        assert resp.status_code == 200
        assert resp.data["step"] == "authorize"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 1
        assert resp.data["provider"] == "bitbucket"
        assert "authorizeUrl" in resp.data["data"]
        assert "bitbucket.org/site/addons/authorize" in resp.data["data"]["authorizeUrl"]

    @responses.activate
    def test_missing_jwt(self) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({})
        assert resp.status_code == 400

    @responses.activate
    @patch(
        "sentry.integrations.bitbucket.integration.get_integration_from_jwt",
        side_effect=AtlassianConnectValidationError("Invalid JWT"),
    )
    def test_invalid_jwt(self, mock_verify: MagicMock) -> None:
        self._initialize_pipeline()
        resp = self._advance_step({"jwt": "invalid-token"})
        assert resp.status_code == 400
        assert "Unable to verify installation" in resp.data["data"]["detail"]

    @responses.activate
    @patch("sentry.integrations.bitbucket.integration.get_integration_from_jwt")
    def test_full_pipeline_flow(self, mock_verify: MagicMock) -> None:
        mock_verify.return_value = RpcIntegration(
            id=self.integration.id,
            provider=self.integration.provider,
            external_id=self.subject,
            name=self.integration.name,
            metadata=self.integration.metadata,
            status=self.integration.status,
        )

        resp = self._initialize_pipeline()
        assert resp.data["step"] == "authorize"

        resp = self._advance_step({"jwt": "valid-jwt-token"})
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"
        assert "data" in resp.data

        assert OrganizationIntegration.objects.filter(
            organization_id=self.organization.id,
            integration=self.integration,
        ).exists()
