import hashlib
from unittest.mock import patch

import pytest
import responses
from django.urls import reverse

from sentry.integrations.perforce.client import InvalidP4Port, validate_p4port_transport
from sentry.integrations.perforce.integration import (
    PerforceInstallationSerializer,
    PerforceIntegration,
    PerforceIntegrationProvider,
)
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.models.repository import Repository
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized, IntegrationError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, IntegrationTestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class PerforceIntegrationTest(IntegrationTestCase):
    provider = PerforceIntegrationProvider
    installation: PerforceIntegration

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
            metadata={},
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

    def test_format_source_url_absolute_path(self) -> None:
        """Test formatting URL with absolute depot path"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="//depot/app/services/processor.cpp", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_relative_path(self) -> None:
        """Test formatting URL with relative path - should prepend depot_path"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_path_starting_with_depot_name(self) -> None:
        """Test that paths starting with depot name don't get duplicated (depot/app -> //depot/app not //depot/depot/app)"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="depot/app/services/processor.cpp", branch=None
        )
        # Should strip "depot/" prefix and prepend "//depot/" -> "//depot/app/services/processor.cpp"
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_absolute_path_starting_with_depot_name(self) -> None:
        """Test that absolute paths with depot name are handled correctly (//depot/app stays as //depot/app)"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="//depot/app/services/processor.cpp", branch=None
        )
        # Should preserve as-is (already absolute)
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_with_revision_in_filename(self) -> None:
        """
        Test formatting URL with revision in filename (from Symbolic transformer).
        Perforce uses # for file revisions, which should be preserved.
        """
        url = self.installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp#1", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp#1"

    def test_format_source_url_swarm_viewer(self) -> None:
        """Test formatting URL for Swarm viewer with revision"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm",
            metadata={
                "web_url": "https://swarm.example.com",
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(
            self.organization.id
        )  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp#1", branch=None
        )
        assert url == "https://swarm.example.com/files//depot/app/services/processor.cpp?v=1"

    def test_format_source_url_swarm_viewer_no_revision(self) -> None:
        """Test formatting URL for Swarm viewer without revision"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm2",
            metadata={
                "web_url": "https://swarm.example.com",
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(
            self.organization.id
        )  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url == "https://swarm.example.com/files//depot/app/services/processor.cpp"

    def test_format_source_url_swarm_viewer_absolute_path(self) -> None:
        """Test Swarm viewer with absolute path (//depot/...)"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm-abs",
            metadata={
                "web_url": "https://swarm.example.com",
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(
            self.organization.id
        )  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="//depot/app/services/processor.cpp", branch=None
        )
        assert url == "https://swarm.example.com/files//depot/app/services/processor.cpp"
        assert "depot/depot" not in url

    def test_format_source_url_swarm_viewer_depot_name_path(self) -> None:
        """Test Swarm viewer with path starting with depot name (depot/...)"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm-depot",
            metadata={
                "web_url": "https://swarm.example.com",
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(
            self.organization.id
        )  # type: ignore[assignment]

        url = installation.format_source_url(
            repo=self.repo, filepath="depot/app/services/processor.cpp", branch=None
        )
        assert url == "https://swarm.example.com/files//depot/app/services/processor.cpp"
        assert "depot/depot" not in url

    def _swarm_installation(self, external_id: str) -> PerforceIntegration:
        """Create a Perforce integration configured with a Swarm web viewer."""
        integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id=external_id,
            metadata={
                "web_url": "https://swarm.example.com",
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
            },
        )
        installation = integration.get_installation(self.organization.id)
        assert isinstance(installation, PerforceIntegration)
        return installation

    def test_format_source_url_swarm_viewer_changelist_branch(self) -> None:
        """
        A numeric `branch` is a changelist (the commit "sha"), not a stream. It must be
        rendered as a Swarm revision (?v=@<changelist>) and must NOT be spliced into the
        depot path as "//depot/<changelist>/...".
        """
        installation = self._swarm_installation("perforce-test-swarm-cl")

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch="2998"
        )

        assert url == "https://swarm.example.com/files//depot/app/services/processor.cpp?v=@2998"
        # Regression guard: the changelist must not become a path segment.
        assert "/2998/" not in url

    def test_format_source_url_swarm_viewer_changelist_with_stream_in_path(self) -> None:
        """
        Mirrors the real demo setup: the stream ("main/") is part of the mapped path
        (from the code mapping's source root) and the changelist arrives via `branch`.
        """
        installation = self._swarm_installation("perforce-test-swarm-cl-stream")

        url = installation.format_source_url(
            repo=self.repo,
            filepath="main/Source/SentryTower/Player/SentryTowerTurret.cpp",
            branch="2998",
        )

        assert url == (
            "https://swarm.example.com/files"
            "//depot/main/Source/SentryTower/Player/SentryTowerTurret.cpp?v=@2998"
        )
        assert "/2998/" not in url

    def test_format_source_url_swarm_viewer_stream_branch(self) -> None:
        """A non-numeric `branch` is a stream name and is inserted after the depot."""
        installation = self._swarm_installation("perforce-test-swarm-stream")

        url = installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch="main"
        )

        assert url == "https://swarm.example.com/files//depot/main/app/services/processor.cpp"

    def test_format_source_url_p4_protocol_changelist_branch(self) -> None:
        """Without a Swarm viewer, a changelist branch uses Perforce '@<changelist>' syntax."""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="app/services/processor.cpp", branch="2998"
        )
        assert url == "p4://depot/app/services/processor.cpp@2998"

    def test_validate_web_url_adds_scheme(self) -> None:
        """A web URL without a scheme is normalized to https:// so links aren't relative."""
        serializer = PerforceInstallationSerializer()
        assert serializer.validate_web_url("swarm.example.com") == "https://swarm.example.com"
        assert serializer.validate_web_url("swarm.example.com/") == "https://swarm.example.com"
        # A scheme-relative URL keeps a single "//" (not "https:////...").
        assert serializer.validate_web_url("//swarm.example.com") == "https://swarm.example.com"
        # An existing scheme is preserved.
        assert (
            serializer.validate_web_url("https://swarm.example.com") == "https://swarm.example.com"
        )
        assert serializer.validate_web_url("http://swarm.example.com") == "http://swarm.example.com"

    @patch("sentry.integrations.perforce.client.is_safe_hostname", return_value=True)
    def test_serializer_normalizes_schemeless_web_url_end_to_end(self, mock_safe_hostname) -> None:
        """
        Exercise the full serializer, not just validate_web_url directly. With a URLField
        the field-level URLValidator rejected schemeless input before validate_web_url ran,
        so the normalization was dead code; CharField makes it actually reachable.
        """
        base = {
            "p4port": "ssl:perforce.example.com:1666",
            "user": "testuser",
            "password": "testpass",
            "auth_type": "password",
            "ssl_fingerprint": "AB:CD",
        }
        serializer = PerforceInstallationSerializer(data={**base, "web_url": "swarm.example.com"})
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["web_url"] == "https://swarm.example.com"

        # Garbage is still rejected after normalization. CamelSnakeSerializer keys
        # error output in camelCase, so the field surfaces as "webUrl".
        bad = PerforceInstallationSerializer(data={**base, "web_url": "not a url"})
        assert not bad.is_valid()
        assert "webUrl" in bad.errors

    def test_format_source_url_strips_leading_slash_from_relative_path(self) -> None:
        """Test that leading slash is stripped from relative paths"""
        url = self.installation.format_source_url(
            repo=self.repo, filepath="/app/services/processor.cpp", branch=None
        )
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_uses_repo_name_as_fallback_depot(self) -> None:
        """Test that repo name is used as depot_path fallback"""
        repo_without_config = Repository.objects.create(
            name="//myproject",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={},
        )

        url = self.installation.format_source_url(
            repo=repo_without_config, filepath="app/services/processor.cpp", branch=None
        )
        assert url == "p4://myproject/app/services/processor.cpp"

    @patch("sentry.integrations.perforce.client.PerforceClient.get_depots")
    def test_get_repositories_derives_external_id_from_depot_path(self, mock_get_depots) -> None:
        """
        get_repositories() must return a depot-path external_id (not empty) so
        periodic repo sync can diff against stored repos. The external_id must
        match what the manual-add path stores (the depot path).
        """
        mock_get_depots.return_value = [
            {"name": "depot", "type": "local", "description": ""},
            {"name": "shared", "type": "local", "description": ""},
        ]

        repos = self.installation.get_repositories()

        assert repos == [
            {
                "name": "depot",
                "identifier": "//depot",
                "external_id": "//depot",
                "default_branch": None,
            },
            {
                "name": "shared",
                "identifier": "//shared",
                "external_id": "//shared",
                "default_branch": None,
            },
        ]

    def test_get_repo_external_id_matches_manual_add(self) -> None:
        """
        The external_id derived during sync must equal the depot path the
        manual-add path stores (PerforceRepositoryProvider.get_repository_data
        sets external_id to the depot path), so the two don't create duplicate
        Repository rows.
        """
        assert self.installation.get_repo_external_id({"name": "depot"}) == "//depot"

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_check_file_absolute_depot_path(self, mock_check_file):
        """Test check_file with absolute depot path (//depot/...)"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}
        result = self.installation.check_file(self.repo, "//depot/app/services/processor.cpp")
        assert result is not None
        assert "//depot/app/services/processor.cpp" in result

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_check_file_path_with_depot_name(self, mock_check_file):
        """Test check_file with path starting with depot name (depot/...)"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}
        result = self.installation.check_file(self.repo, "depot/app/services/processor.cpp")
        assert result is not None
        # Should not duplicate depot name in result
        assert "//depot/app/services/processor.cpp" in result
        assert "depot/depot" not in result

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_check_file_relative_path(self, mock_check_file):
        """Test check_file with normal relative path (app/...)"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}
        result = self.installation.check_file(self.repo, "app/services/processor.cpp")
        assert result is not None
        assert "//depot/app/services/processor.cpp" in result

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_check_file_with_revision_syntax_absolute(self, mock_check_file):
        """Test check_file with #revision syntax on absolute path"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}
        result = self.installation.check_file(self.repo, "//depot/app/services/processor.cpp#1")
        assert result is not None
        assert "#1" in result

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_check_file_with_revision_syntax_depot_name(self, mock_check_file):
        """Test check_file with #revision syntax on path with depot name"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}
        result = self.installation.check_file(self.repo, "depot/app/services/processor.cpp#1")
        assert result is not None
        assert "#1" in result
        assert "depot/depot" not in result

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_check_file_with_revision_syntax_relative(self, mock_check_file):
        """Test check_file with #revision syntax on relative path"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}
        result = self.installation.check_file(self.repo, "app/services/processor.cpp#1")
        assert result is not None
        assert "#1" in result

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_link(self, mock_check_file):
        """Test get_stacktrace_link returns format_source_url result"""
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}
        filepath = "app/services/processor.cpp#1"
        default_branch = ""  # Perforce doesn't require default_branch (used for streams)
        version = None

        url = self.installation.get_stacktrace_link(self.repo, filepath, default_branch, version)
        # The # character is preserved as-is (not URL-encoded in this method)
        assert url == "p4://depot/app/services/processor.cpp#1"
        assert "#1" in url

    @patch("sentry.integrations.perforce.client.PerforceClient.check_file")
    def test_get_stacktrace_link_changelist_not_url_encoded(self, mock_check_file):
        """
        A changelist arriving as `version` renders as Perforce '@<changelist>' syntax in
        the p4:// fallback. `@` is a valid path character and must survive the encode_url
        step in get_stacktrace_link -- if it becomes %40 the p4:// link breaks.
        """
        mock_check_file.return_value = {"depotFile": "//depot/app/services/processor.cpp"}

        url = self.installation.get_stacktrace_link(
            self.repo, "app/services/processor.cpp", "", "2998"
        )
        assert url == "p4://depot/app/services/processor.cpp@2998"
        assert "%40" not in url

    def test_extract_source_path_strips_p4_changelist(self) -> None:
        """A p4:// URL with an @<changelist> suffix yields the bare file path."""
        path = self.installation.extract_source_path_from_source_url(
            self.repo, "p4://depot/app/services/processor.cpp@2998"
        )
        assert path == "app/services/processor.cpp"

    def test_extract_source_path_strips_p4_file_revision(self) -> None:
        """A p4:// URL with a #<file-revision> suffix yields the bare file path."""
        path = self.installation.extract_source_path_from_source_url(
            self.repo, "p4://depot/app/services/processor.cpp#42"
        )
        assert path == "app/services/processor.cpp"

    def test_extract_source_path_preserves_in_path_at_sign(self) -> None:
        """
        An `@` inside the path (e.g. a scoped dir like `@babel`) must NOT be treated as
        a changelist specifier -- only a trailing `@<digits>` is stripped.
        """
        # No changelist: the `@babel` segment is preserved verbatim.
        assert (
            self.installation.extract_source_path_from_source_url(
                self.repo, "p4://depot/node_modules/@babel/core.js"
            )
            == "node_modules/@babel/core.js"
        )
        # With a trailing changelist: only the `@2998` suffix is removed.
        assert (
            self.installation.extract_source_path_from_source_url(
                self.repo, "p4://depot/node_modules/@babel/core.js@2998"
            )
            == "node_modules/@babel/core.js"
        )

    def test_extract_source_path_strips_swarm_changelist_query(self) -> None:
        """A Swarm URL carrying the changelist as ?v=@<cl> yields the bare file path."""
        integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-extract-swarm",
            metadata={
                "web_url": "https://swarm.example.com",
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
            },
        )
        installation = integration.get_installation(self.organization.id)
        assert isinstance(installation, PerforceIntegration)

        path = installation.extract_source_path_from_source_url(
            self.repo,
            "https://swarm.example.com/files//depot/app/services/processor.cpp?v=@2998",
        )
        assert path == "app/services/processor.cpp"

    def test_integration_name(self) -> None:
        """Test integration has correct name"""
        assert self.installation.model.name == "Perforce"

    def test_integration_provider(self) -> None:
        """Test integration has correct provider"""
        assert self.installation.model.provider == "perforce"


class PerforceP4PortValidationTest(IntegrationTestCase):
    provider = PerforceIntegrationProvider

    def _base_payload(self) -> dict[str, str]:
        return {
            "p4port": "ssl:perforce.example.com:1666",
            "user": "testuser",
            "password": "testpass",
            "auth_type": "password",
            "ssl_fingerprint": "AB:CD",
        }

    def test_validate_p4port_transport_rejects_invalid(self) -> None:
        for value in (
            "abc:host:1666",
            "1666",
            ":1666",
            "tcp:123.123.123.123",
            "ssl:perforce.example.com",
            "2001:db8::1:1666",
            "ssl:[2001:db8::1]:1666",
        ):
            with pytest.raises(InvalidP4Port):
                validate_p4port_transport(value)

    @patch("sentry.integrations.perforce.client.is_safe_hostname", return_value=True)
    def test_validate_p4port_transport_allows_host_port(self, mock_safe_hostname) -> None:
        for value in (
            "perforce.example.com:1666",
            "test-host.example.com:1666",
            "123.123.123.123:1666",
            "tcp:123.123.123.123:1666",
            "SSL:perforce.example.com:1666",
        ):
            validate_p4port_transport(value)

    @patch("sentry.integrations.perforce.client.is_safe_hostname", return_value=True)
    def test_validate_p4port_transport_allows_every_transport(self, mock_safe_hostname) -> None:
        for transport in (
            "tcp",
            "tcp4",
            "tcp6",
            "tcp46",
            "tcp64",
            "ssl",
            "ssl4",
            "ssl6",
            "ssl46",
            "ssl64",
        ):
            validate_p4port_transport(f"{transport}:perforce.example.com:1666")

    def test_validate_p4port_transport_rejects_disallowed_transport(self) -> None:
        for transport in (
            "http",
            "https",
            "file",
            "udp",
            "tcp5",
            "sslx",
            "abc",
        ):
            with pytest.raises(InvalidP4Port):
                validate_p4port_transport(f"{transport}:perforce.example.com:1666")

    @patch("sentry.integrations.perforce.client.is_safe_hostname", return_value=True)
    def test_serializer_accepts_valid_p4port(self, mock_safe_hostname) -> None:
        serializer = PerforceInstallationSerializer(data=self._base_payload())
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data["p4port"] == "ssl:perforce.example.com:1666"

    def test_serializer_rejects_internal_host(self) -> None:
        payload = self._base_payload()
        payload["p4port"] = "tcp:169.254.169.254:1666"
        serializer = PerforceInstallationSerializer(data=payload)
        assert not serializer.is_valid()
        assert "p4port" in serializer.errors

    def test_client_connect_rejects_invalid_p4port_metadata(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            integration = self.create_integration(
                organization=self.organization,
                provider="perforce",
                name="Perforce",
                external_id="perforce-test",
                metadata={"p4port": "abc:1234", "user": "u", "password": "p"},
            )
        installation = integration.get_installation(self.organization.id)
        client = installation.get_client()
        with pytest.raises(ApiError):
            with client._connect():
                pass

    def test_client_connect_rejects_internal_host(self) -> None:
        with assume_test_silo_mode(SiloMode.CELL):
            integration = self.create_integration(
                organization=self.organization,
                provider="perforce",
                name="Perforce",
                external_id="perforce-local",
                metadata={"p4port": "tcp:169.254.169.254:1666", "user": "u", "password": "p"},
            )
        installation = integration.get_installation(self.organization.id)
        client = installation.get_client()
        with pytest.raises(ApiError):
            with client._connect():
                pass

    def _installation_for_update(self, external_id: str) -> PerforceIntegration:
        with assume_test_silo_mode(SiloMode.CELL):
            integration = self.create_integration(
                organization=self.organization,
                provider="perforce",
                name="Perforce",
                external_id=external_id,
                metadata={"p4port": "ssl:perforce.example.com:1666", "user": "u", "password": "p"},
            )
        installation = integration.get_installation(self.organization.id)
        assert isinstance(installation, PerforceIntegration)
        return installation

    def test_update_organization_config_rejects_disallowed_transport(self) -> None:
        installation = self._installation_for_update("perforce-update-invalid")
        with pytest.raises(IntegrationError):
            installation.update_organization_config({"p4port": "demo:test"})

    def test_update_organization_config_rejects_internal_host(self) -> None:
        installation = self._installation_for_update("perforce-update-local")
        with pytest.raises(IntegrationError):
            installation.update_organization_config({"p4port": "tcp:169.254.169.254:1666"})

    @patch("sentry.integrations.perforce.client.is_safe_hostname", return_value=True)
    def test_update_organization_config_accepts_and_normalizes_p4port(
        self, mock_safe_hostname
    ) -> None:
        installation = self._installation_for_update("perforce-update-ok")
        installation.update_organization_config({"p4port": "tcp:perforce.example.com:1666/"})
        assert installation.get_config_data()["p4port"] == "tcp:perforce.example.com:1666"


class PerforceIntegrationCodeMappingTest(IntegrationTestCase):
    """Tests for Perforce integration with code mappings"""

    provider = PerforceIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
            metadata={},
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

    def test_format_source_url_from_code_mapping_output(self) -> None:
        """
        Test that paths coming from code mapping (depot/ -> /) work correctly.
        Code mapping strips 'depot/' and leaves 'app/services/processor.cpp',
        which should be prepended with depot_path.
        """
        # This is what code mapping would output after stripping "depot/"
        code_mapped_path = "app/services/processor.cpp"

        url = self.installation.format_source_url(
            repo=self.repo, filepath=code_mapped_path, branch=None
        )

        # Should prepend depot_path to create full depot path
        assert url == "p4://depot/app/services/processor.cpp"

    def test_format_source_url_preserves_revision_in_filename(self) -> None:
        """
        Test that #revision syntax in filename is preserved.
        This tests the Symbolic transformer output format.
        """
        # This is what Symbolic transformer outputs
        symbolic_path = "app/services/processor.cpp#1"

        url = self.installation.format_source_url(
            repo=self.repo, filepath=symbolic_path, branch=None
        )

        # The #1 should be preserved in the path
        assert url == "p4://depot/app/services/processor.cpp#1"

    def test_format_source_url_python_path_without_revision(self) -> None:
        """Test Python SDK paths without revision"""
        # Python SDK typically doesn't include revisions
        python_path = "app/services/processor.py"

        url = self.installation.format_source_url(repo=self.repo, filepath=python_path, branch=None)

        assert url == "p4://depot/app/services/processor.py"


class PerforceIntegrationDepotPathTest(IntegrationTestCase):
    """Tests for depot path handling in different scenarios"""

    provider = PerforceIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
        )
        self.installation = self.integration.get_installation(self.organization.id)

    def test_multiple_depots(self) -> None:
        """Test handling multiple depot configurations"""
        depot_repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        myproject_repo = Repository.objects.create(
            name="//myproject",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//myproject"},
        )

        # Test depot
        url1 = self.installation.format_source_url(
            repo=depot_repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url1 == "p4://depot/app/services/processor.cpp"

        # Test myproject
        url2 = self.installation.format_source_url(
            repo=myproject_repo, filepath="app/services/processor.cpp", branch=None
        )
        assert url2 == "p4://myproject/app/services/processor.cpp"

    def test_nested_depot_paths(self) -> None:
        """Test handling nested depot paths"""
        repo = Repository.objects.create(
            name="//depot/game/project",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot/game/project"},
        )

        url = self.installation.format_source_url(repo=repo, filepath="src/main.cpp", branch=None)
        assert url == "p4://depot/game/project/src/main.cpp"

    def test_depot_path_with_trailing_slash(self) -> None:
        """Test depot_path with trailing slash is handled correctly"""
        repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot/"},
        )

        url = self.installation.format_source_url(
            repo=repo, filepath="app/services/processor.cpp", branch=None
        )
        # Should not have double slashes in path portion
        assert url == "p4://depot/app/services/processor.cpp"


class PerforceIntegrationWebViewersTest(IntegrationTestCase):
    """Tests for web viewer URL formatting"""

    provider = PerforceIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test",
            metadata={},
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.repo = Repository.objects.create(
            name="//depot",
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

    def test_swarm_extracts_revision_from_filename(self) -> None:
        """Test Swarm viewer correctly extracts and formats revision from #revision syntax"""
        integration_with_swarm = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce",
            external_id="perforce-test-swarm3",
            metadata={
                "web_url": "https://swarm.example.com",
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
            },
        )
        installation: PerforceIntegration = integration_with_swarm.get_installation(
            self.organization.id
        )  # type: ignore[assignment]

        # Filename with revision
        url = installation.format_source_url(
            repo=self.repo, filepath="game/src/main.cpp#1", branch=None
        )

        # Should extract #1 and use it as v parameter
        assert url == "https://swarm.example.com/files//depot/game/src/main.cpp?v=1"


class PerforceIntegrationEndToEndTest(IntegrationTestCase):
    """
    End-to-end test covering the full integration lifecycle:
    - Installation with credentials
    - Configuration retrieval
    - Partial updates
    - Full updates
    """

    provider = PerforceIntegrationProvider

    def test_integration_lifecycle(self) -> None:
        """Test complete integration lifecycle from installation to updates"""

        # Step 1: Simulate installation with build_integration
        provider = PerforceIntegrationProvider()
        state = {
            "organization_id": self.organization.id,
            "installation_data": {
                "p4port": "ssl:perforce.example.com:1666",
                "user": "sentry-bot",
                "auth_type": "password",
                "password": "initial_password",
                "client": "sentry-workspace",
                "ssl_fingerprint": "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD",
                "web_url": "https://swarm.example.com",
                "charset": "utf8",
            },
            "name": "Perforce (ssl:perforce.example.com:1666)",
        }

        integration_data = provider.build_integration(state)

        # Verify integration data structure
        assert integration_data["name"] == "Perforce (ssl:perforce.example.com:1666)"

        # Verify external_id format: perforce-org-{org_id}-{hash}
        # Hash is first 8 chars of SHA256(p4port)
        p4port_hash = hashlib.sha256(b"ssl:perforce.example.com:1666").hexdigest()[:8]
        expected_external_id = f"perforce-org-{self.organization.id}-{p4port_hash}"
        assert integration_data["external_id"] == expected_external_id

        assert "metadata" in integration_data

        # Verify all credentials are in metadata
        metadata = integration_data["metadata"]
        assert metadata["p4port"] == "ssl:perforce.example.com:1666"
        assert metadata["user"] == "sentry-bot"
        assert metadata["auth_type"] == "password"
        assert metadata["password"] == "initial_password"
        assert metadata["client"] == "sentry-workspace"
        assert (
            metadata["ssl_fingerprint"]
            == "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD"
        )
        assert metadata["web_url"] == "https://swarm.example.com"
        assert metadata["charset"] == "utf8"

        # Step 2: Create integration (simulating ensure_integration)
        integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name=integration_data["name"],
            external_id=integration_data["external_id"],
            metadata=integration_data["metadata"],
        )

        # Step 3: Get installation and verify configuration retrieval
        installation: PerforceIntegration = integration.get_installation(self.organization.id)  # type: ignore[assignment]

        # Test get_organization_config returns form schema
        org_config = installation.get_organization_config()
        assert len(org_config) == 8  # 8 configuration fields
        field_names = {field["name"] for field in org_config}
        assert field_names == {
            "p4port",
            "user",
            "auth_type",
            "password",
            "ssl_fingerprint",
            "client",
            "web_url",
            "charset",
        }

        # Verify field types
        field_types = {field["name"]: field["type"] for field in org_config}
        assert field_types["p4port"] == "string"
        assert field_types["user"] == "string"
        assert field_types["auth_type"] == "choice"
        assert field_types["password"] == "secret"
        assert field_types["ssl_fingerprint"] == "string"
        assert field_types["client"] == "string"
        assert field_types["web_url"] == "string"
        assert field_types["charset"] == "choice"

        # Test get_config_data returns current values, with the credential
        # field omitted (allowlist mode — see _CONFIG_DATA_ALLOWLIST). The
        # raw password remains in integration.metadata for the client to use.
        config_data = installation.get_config_data()
        assert config_data["p4port"] == "ssl:perforce.example.com:1666"
        assert config_data["user"] == "sentry-bot"
        assert "password" not in config_data
        assert config_data["client"] == "sentry-workspace"
        assert (
            config_data["ssl_fingerprint"]
            == "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD"
        )
        assert config_data["web_url"] == "https://swarm.example.com"
        assert config_data["charset"] == "utf8"
        assert integration.metadata["password"] == "initial_password"

        # Step 4: Test partial update (only change password)
        installation.update_organization_config({"password": "updated_password_123"})

        # Refresh and verify password changed but other fields preserved
        integration.refresh_from_db()
        updated_config = installation.get_config_data()
        assert "password" not in updated_config
        assert integration.metadata["password"] == "updated_password_123"
        assert updated_config["p4port"] == "ssl:perforce.example.com:1666"  # Preserved
        assert updated_config["user"] == "sentry-bot"  # Preserved
        assert updated_config["client"] == "sentry-workspace"  # Preserved
        assert (
            updated_config["ssl_fingerprint"]
            == "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD"
        )  # Preserved
        assert updated_config["web_url"] == "https://swarm.example.com"  # Preserved

        # Step 5: Test multiple field update
        installation.update_organization_config(
            {
                "user": "new-user",
                "client": "new-workspace",
                "web_url": "https://new-swarm.example.com",
            }
        )

        # Refresh and verify multiple fields changed
        integration.refresh_from_db()
        final_config = installation.get_config_data()
        assert final_config["user"] == "new-user"
        assert final_config["client"] == "new-workspace"
        assert final_config["web_url"] == "https://new-swarm.example.com"
        # Verify other fields still preserved
        assert "password" not in final_config
        assert integration.metadata["password"] == "updated_password_123"  # From previous update
        assert final_config["p4port"] == "ssl:perforce.example.com:1666"  # Original value
        assert (
            final_config["ssl_fingerprint"]
            == "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD"
        )  # Original value

        # Step 6: Verify empty optional fields don't break anything
        installation.update_organization_config(
            {
                "client": "",  # Clear client
                "web_url": "",  # Clear web_url
            }
        )

        integration.refresh_from_db()
        cleared_config = installation.get_config_data()
        assert cleared_config["client"] == ""
        assert cleared_config["web_url"] == ""
        # Required fields still preserved
        assert cleared_config["p4port"] == "ssl:perforce.example.com:1666"
        assert cleared_config["user"] == "new-user"
        assert "password" not in cleared_config
        assert integration.metadata["password"] == "updated_password_123"


@control_silo_test
class PerforceApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self):
        super().setUp()
        self.login_as(self.user)
        patcher = patch("sentry.integrations.perforce.client.is_safe_hostname", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _init_pipeline_in_session(self) -> IntegrationPipeline:
        with assume_test_silo_mode(SiloMode.CELL):
            rpc_org = serialize_rpc_organization(self.organization)

        request = self.make_request(self.user)
        pipeline = IntegrationPipeline(
            request=request,
            organization=rpc_org,
            provider_key="perforce",
        )
        pipeline.initialize()
        self.save_session()
        return pipeline

    @responses.activate
    @patch(
        "sentry.integrations.perforce.integration.PerforceClient.get_depots",
        return_value=[{"name": "depot"}],
    )
    def test_successful_connection(self, mock_get_depots) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.get(url)
        assert resp.status_code == 200
        assert resp.data["step"] == "installation_config"
        assert resp.data["data"] == {}

        resp = self.client.post(
            url,
            data={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "sentry-bot",
                "authType": "password",
                "password": "secret",
                "sslFingerprint": "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
            },
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

    @responses.activate
    @patch(
        "sentry.integrations.perforce.integration.PerforceClient.get_depots",
        side_effect=ApiUnauthorized("bad credentials"),
    )
    def test_auth_failure_returns_error(self, mock_get_depots) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "bad-user",
                "authType": "password",
                "password": "wrong",
                "sslFingerprint": "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "Authentication failed" in resp.data["data"]["detail"]

    @responses.activate
    @patch(
        "sentry.integrations.perforce.integration.PerforceClient.get_depots",
        side_effect=ApiError("connection refused"),
    )
    def test_connection_failure_returns_error(self, mock_get_depots) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "p4port": "ssl:bad-host:1666",
                "user": "user",
                "authType": "password",
                "password": "pass",
                "sslFingerprint": "AB:CD:EF:01:23:45:67:89:AB:CD:EF:01:23:45:67:89:AB:CD:EF:01",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "Failed to connect" in resp.data["data"]["detail"]

    @responses.activate
    def test_missing_required_fields(self) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(url, data={}, format="json")
        assert resp.status_code == 400

    @responses.activate
    def test_ssl_port_requires_fingerprint(self) -> None:
        pipeline = self._init_pipeline_in_session()
        pipeline.set_api_mode()
        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "sentry-bot",
                "authType": "password",
                "password": "secret",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "sslFingerprint" in resp.data


@control_silo_test
class PerforceIntegrationConfigDataApiTest(APITestCase):
    """
    Regression test for password exposure: the org integrations index endpoint must
    not echo the Perforce credential in configData. The endpoint is reachable
    by org:read, so any leak there exposes the password / P4 ticket to every
    member of the organization.
    """

    endpoint = "sentry-api-0-organization-integrations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce (ssl:perforce.example.com:1666)",
            external_id="perforce-org-1-abcdef12",
            metadata={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "sentry-bot",
                "auth_type": "password",
                "password": "super-secret-password",
                "client": "sentry-workspace",
                "ssl_fingerprint": "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD",
                "web_url": "https://swarm.example.com",
            },
        )

    def test_config_data_excludes_credential(self) -> None:
        response = self.get_success_response(
            self.organization.slug, qs_params={"providerKey": "perforce"}
        )
        assert len(response.data) == 1
        config_data = response.data[0]["configData"]
        # The credential field stores both passwords and P4 tickets — must
        # never appear in the API response regardless of auth_type.
        assert "password" not in config_data
        # Sanity check: non-secret fields still reach the form.
        assert config_data["p4port"] == "ssl:perforce.example.com:1666"
        assert config_data["user"] == "sentry-bot"
        assert config_data["auth_type"] == "password"

    def test_config_data_excludes_ticket(self) -> None:
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(
                metadata={
                    **self.integration.metadata,
                    "auth_type": "ticket",
                    "password": "p4-ticket-value",
                }
            )

        response = self.get_success_response(
            self.organization.slug, qs_params={"providerKey": "perforce"}
        )
        config_data = response.data[0]["configData"]
        assert "password" not in config_data
        assert "p4-ticket-value" not in str(config_data)
        assert config_data["auth_type"] == "ticket"
