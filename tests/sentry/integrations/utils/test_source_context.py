from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry.integrations.utils.source_context import (
    _format_context,
    fetch_source_context_from_scm,
)
from sentry.issues.endpoints.project_stacktrace_link import StacktraceLinkContext
from sentry.shared_integrations.exceptions import ApiError, ApiRateLimitedError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class FormatContextTest(TestCase):
    def test_format_context_basic(self) -> None:
        pre = [b"line1", b"line2"]
        ctx_line = b"line3"
        post = [b"line4", b"line5"]
        result = _format_context(pre, ctx_line, post, lineno=3)
        assert result == [
            [1, "line1"],
            [2, "line2"],
            [3, "line3"],
            [4, "line4"],
            [5, "line5"],
        ]

    def test_format_context_no_pre_or_post(self) -> None:
        result = _format_context(None, b"only_line", None, lineno=1)
        assert result == [[1, "only_line"]]

    def test_format_context_none_context_line(self) -> None:
        result = _format_context(None, None, None, lineno=1)
        assert result == []

    def test_format_context_utf8_decode(self) -> None:
        result = _format_context(None, "héllo".encode(), None, lineno=1)
        assert result == [[1, "héllo"]]


class FetchSourceContextTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration, self.oi = self.create_provider_integration_for(
                self.organization, self.user, provider="example", name="Example"
            )

        self.repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
        )
        self.repo.integration_id = self.integration.id
        self.repo.provider = "example"
        self.repo.save()

        self.code_mapping = self.create_code_mapping(
            organization_integration=self.oi,
            project=self.project,
            repo=self.repo,
            stack_root="src/",
            source_root="src/",
        )

    def _make_ctx(self, **overrides: str | None) -> StacktraceLinkContext:
        defaults: StacktraceLinkContext = {
            "file": "src/app/main.py",
            "filename": "src/app/main.py",
            "platform": "python",
            "abs_path": "src/app/main.py",
            "commit_id": None,
            "group_id": None,
            "line_no": "10",
            "module": None,
            "package": None,
            "sdk_name": None,
        }
        defaults.update(overrides)  # type: ignore[typeddict-item]
        return defaults

    def test_missing_line_number(self) -> None:
        ctx = self._make_ctx(line_no=None)
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "missing_line_number"
        assert result["context"] == []

    def test_invalid_line_number(self) -> None:
        ctx = self._make_ctx(line_no="abc")
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "invalid_line_number"
        assert result["context"] == []

    def test_no_code_mapping_match(self) -> None:
        ctx = self._make_ctx(
            file="unknown/path.py", filename="unknown/path.py", abs_path="unknown/path.py"
        )
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "no_code_mapping_match"
        assert result["context"] == []

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_integration_not_found(self, mock_service: MagicMock) -> None:
        mock_service.get_integration.return_value = None
        ctx = self._make_ctx()
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "no_code_mapping_match"

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_successful_fetch(self, mock_service: MagicMock) -> None:
        file_content = "\n".join([f"line{i}" for i in range(1, 20)])

        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_client = MagicMock()
        mock_install.get_client.return_value = mock_client
        mock_client.get_file.return_value = file_content
        mock_install.get_stacktrace_link.return_value = "https://github.com/example"

        # Make mock pass isinstance check
        from sentry.integrations.source_code_management.repository import RepositoryIntegration

        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]

        ctx = self._make_ctx(line_no="10")
        result = fetch_source_context_from_scm([self.code_mapping], ctx)

        assert result["error"] is None
        assert len(result["context"]) == 11  # 5 pre + 1 context + 5 post
        assert result["context"][5] == [10, "line10"]
        assert result["source_url"] == "https://github.com/example"

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_get_file_not_supported(self, mock_service: MagicMock) -> None:
        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_client = MagicMock()
        mock_install.get_client.return_value = mock_client
        mock_client.get_file.side_effect = NotImplementedError

        from sentry.integrations.source_code_management.repository import RepositoryIntegration

        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]

        ctx = self._make_ctx()
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "get_file_not_supported"

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_rate_limited(self, mock_service: MagicMock) -> None:
        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_client = MagicMock()
        mock_install.get_client.return_value = mock_client
        mock_client.get_file.side_effect = ApiRateLimitedError("rate limited")

        from sentry.integrations.source_code_management.repository import RepositoryIntegration

        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]

        ctx = self._make_ctx()
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "rate_limited"

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_file_not_found(self, mock_service: MagicMock) -> None:
        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_client = MagicMock()
        mock_install.get_client.return_value = mock_client
        mock_client.get_file.side_effect = ApiError("Not Found", code=404)

        from sentry.integrations.source_code_management.repository import RepositoryIntegration

        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]

        ctx = self._make_ctx()
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "file_not_found"

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_line_out_of_range(self, mock_service: MagicMock) -> None:
        file_content = "line1\nline2\nline3"

        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_client = MagicMock()
        mock_install.get_client.return_value = mock_client
        mock_client.get_file.return_value = file_content

        from sentry.integrations.source_code_management.repository import RepositoryIntegration

        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]

        ctx = self._make_ctx(line_no="100")
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "line_out_of_range"

    @patch("sentry.integrations.utils.source_context.integration_service")
    def test_get_client_exception(self, mock_service: MagicMock) -> None:
        mock_integration = MagicMock()
        mock_service.get_integration.return_value = mock_integration
        mock_install = MagicMock()
        mock_integration.get_installation.return_value = mock_install
        mock_install.get_client.side_effect = Exception("identity not found")

        from sentry.integrations.source_code_management.repository import RepositoryIntegration

        mock_install.__class__ = RepositoryIntegration  # type: ignore[assignment]

        ctx = self._make_ctx()
        result = fetch_source_context_from_scm([self.code_mapping], ctx)
        assert result["error"] == "integration_error"
