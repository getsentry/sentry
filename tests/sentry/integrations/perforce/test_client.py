import os
from datetime import datetime, timezone
from unittest import mock

import pytest

from sentry.integrations.perforce.client import PerforceClient
from sentry.integrations.source_code_management.commit_context import SourceLineInfo
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class PerforceClientTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce Test",
            external_id="perforce-test",
            metadata={
                "p4port": "perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
                "auth_type": "password",
            },
        )
        self.org_integration = self.integration.organizationintegration_set.first()

        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="//depot",
            provider="integrations:perforce",
            external_id="//depot",
            integration_id=self.integration.id,
            config={"depot_path": "//depot"},
        )

        self.p4_client = PerforceClient(
            integration=self.integration, org_integration=self.org_integration
        )

        # These tests mock the P4 connection with placeholder hosts that don't
        # resolve; bypass the SSRF host check (covered in test_integration.py).
        patcher = mock.patch(
            "sentry.integrations.perforce.client.is_safe_hostname", return_value=True
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_blame_for_files_success(self, mock_p4_class):
        """Test get_blame_for_files returns commit info for files"""
        # Mock P4 instance
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock p4 changes responses (simpler now - one call per file)
        mock_p4.run.side_effect = [
            # First call: changes for file 1
            [
                {
                    "change": "12345",
                    "user": "johndoe",
                    "time": "1609459200",  # 2021-01-01 00:00:00 UTC
                    "desc": "Fix bug in main module",
                }
            ],
            # Second call: user lookup for johndoe
            [{"User": "johndoe", "Email": "", "FullName": ""}],
            # Third call: changes for file 2
            [
                {
                    "change": "12346",
                    "user": "janedoe",
                    "time": "1609545600",  # 2021-01-02 00:00:00 UTC
                    "desc": "Add utility functions",
                }
            ],
            # Fourth call: user lookup for janedoe
            [{"User": "janedoe", "Email": "", "FullName": ""}],
        ]

        file1 = SourceLineInfo(
            path="src/main.py",
            lineno=10,
            ref="",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file2 = SourceLineInfo(
            path="src/utils.py",
            lineno=25,
            ref="",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

        blames = self.p4_client.get_blame_for_files([file1, file2], extra={})

        assert len(blames) == 2

        # Check first blame
        assert blames[0].path == "src/main.py"
        assert blames[0].lineno == 10
        assert blames[0].commit.commitId == "12345"
        assert blames[0].commit.commitAuthorName == "johndoe"
        assert blames[0].commit.commitAuthorEmail == "johndoe@perforce"
        assert blames[0].commit.commitMessage == "Fix bug in main module"
        assert blames[0].commit.committedDate == datetime(2021, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

        # Check second blame
        assert blames[1].path == "src/utils.py"
        assert blames[1].lineno == 25
        assert blames[1].commit.commitId == "12346"
        assert blames[1].commit.commitAuthorName == "janedoe"
        assert blames[1].commit.commitAuthorEmail == "janedoe@perforce"
        assert blames[1].commit.commitMessage == "Add utility functions"
        assert blames[1].commit.committedDate == datetime(2021, 1, 2, 0, 0, 0, tzinfo=timezone.utc)

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_blame_for_files_no_changelist(self, mock_p4_class):
        """Test get_blame_for_files handles files with no changelist"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock p4 changes response with empty result (no changes for this file)
        mock_p4.run.return_value = []

        file = SourceLineInfo(
            path="src/new_file.py",
            lineno=10,
            ref="",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

        blames = self.p4_client.get_blame_for_files([file], extra={})

        # Should return empty list when no changelist found
        assert len(blames) == 0

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_blame_for_files_with_stream(self, mock_p4_class):
        """Test get_blame_for_files handles files with stream (ref).

        Note: The stream name in ref is ignored because the path from SourceLineInfo
        already contains the full depot path including any stream/branch information.
        """
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        mock_p4.run.side_effect = [
            # changes for file with stream
            [
                {
                    "change": "12345",
                    "user": "johndoe",
                    "time": "1609459200",
                    "desc": "Initial commit",
                }
            ],
            # user lookup for johndoe
            [{"User": "johndoe", "Email": "", "FullName": ""}],
        ]

        file = SourceLineInfo(
            path="src/main.py",
            lineno=10,
            ref="main",  # Stream name (ignored - path already contains full depot path)
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

        blames = self.p4_client.get_blame_for_files([file], extra={})

        assert len(blames) == 1
        # Verify changes was called with the depot path (stream from ref is not used)
        assert mock_p4.run.call_args_list[0][0] == (
            "changes",
            "-m",
            "1",
            "-l",
            "//depot/src/main.py",
        )

    @mock.patch("sentry.integrations.perforce.client.P4")
    @mock.patch("sentry.integrations.perforce.client.logger")
    def test_get_blame_for_files_p4_exception(self, mock_logger, mock_p4_class):
        """Test get_blame_for_files handles P4 exceptions gracefully"""
        from sentry.integrations.perforce.p4protocol import P4Exception

        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # First file succeeds, second file throws exception
        mock_p4.run.side_effect = [
            # File 1 changes
            [
                {
                    "change": "12345",
                    "user": "johndoe",
                    "time": "1609459200",
                    "desc": "Initial commit",
                }
            ],
            # File 1 user lookup for johndoe
            [{"User": "johndoe", "Email": "", "FullName": ""}],
            # File 2 changes - throws exception
            P4Exception("File not found"),
        ]

        file1 = SourceLineInfo(
            path="src/main.py",
            lineno=10,
            ref="",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )
        file2 = SourceLineInfo(
            path="src/missing.py",
            lineno=20,
            ref="",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

        blames = self.p4_client.get_blame_for_files([file1, file2], extra={})

        # Should return blame for file1 only
        assert len(blames) == 1
        assert blames[0].path == "src/main.py"

        # Should log warning for file2
        assert mock_logger.warning.called

    @mock.patch("sentry.integrations.perforce.client.P4")
    @mock.patch("sentry.integrations.perforce.client.logger")
    def test_get_blame_for_files_invalid_time(self, mock_logger, mock_p4_class):
        """Test get_blame_for_files handles invalid time values gracefully"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock with invalid time value (non-numeric string)
        mock_p4.run.side_effect = [
            # changes with invalid time value
            [
                {
                    "change": "12345",
                    "user": "johndoe",
                    "time": "invalid",  # Invalid time value that will raise ValueError
                    "desc": "Initial commit",
                }
            ],
            # user lookup for johndoe
            [{"User": "johndoe", "Email": "", "FullName": ""}],
        ]

        file = SourceLineInfo(
            path="src/main.py",
            lineno=10,
            ref="",
            repo=self.repo,
            code_mapping=None,  # type: ignore[arg-type]
        )

        blames = self.p4_client.get_blame_for_files([file], extra={})

        # Should still return blame with epoch time (0)
        assert len(blames) == 1
        assert blames[0].commit.committedDate == datetime(1970, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

        # Should log warning about invalid time
        assert mock_logger.warning.called
        warning_calls = [str(call) for call in mock_logger.warning.call_args_list]
        assert any("invalid_time_value" in call for call in warning_calls)

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_depots(self, mock_p4_class):
        """Test get_depots returns depot list"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock depots response
        mock_p4.run.return_value = [
            {"name": "depot", "type": "local", "desc": "Main depot"},
            {"name": "myproject", "type": "stream", "desc": "Project stream depot"},
        ]

        depots = self.p4_client.get_depots()

        # Verify p4 depots command was called
        mock_p4.run.assert_called_once_with("depots")

        # Check results
        assert len(depots) == 2
        assert depots[0]["name"] == "depot"
        assert depots[0]["type"] == "local"
        assert depots[0]["description"] == "Main depot"

        assert depots[1]["name"] == "myproject"
        assert depots[1]["type"] == "stream"
        assert depots[1]["description"] == "Project stream depot"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_user_existing(self, mock_p4_class):
        """Test get_user returns user info for existing user"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock user response for existing user
        mock_p4.run.return_value = [
            {
                "User": "johndoe",
                "Email": "john.doe@example.com",
                "FullName": "John Doe",
                "Update": "2021/01/01 12:00:00",  # Indicates user exists
            }
        ]

        user_info = self.p4_client.get_user("johndoe")

        # Verify p4 user command was called
        mock_p4.run.assert_called_once_with("user", "-o", "johndoe")

        # Check results
        assert user_info is not None
        assert user_info["username"] == "johndoe"
        assert user_info["email"] == "john.doe@example.com"
        assert user_info["full_name"] == "John Doe"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_user_nonexistent(self, mock_p4_class):
        """Test get_user returns None for non-existent user"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock user response for non-existent user (template with no Update field)
        mock_p4.run.return_value = [
            {
                "User": "newuser",
                "Email": "",
                "FullName": "",
                # No Update field - indicates user doesn't exist
            }
        ]

        user_info = self.p4_client.get_user("newuser")

        # Should return None for non-existent user
        assert user_info is None

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_changes_without_range(self, mock_p4_class):
        """Test get_changes returns changelists without start/end range"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock changes response
        mock_p4.run.return_value = [
            {
                "change": "12346",
                "user": "janedoe",
                "client": "jane-workspace",
                "time": "1609545600",
                "desc": "Add utility functions",
            },
            {
                "change": "12345",
                "user": "johndoe",
                "client": "john-workspace",
                "time": "1609459200",
                "desc": "Fix bug in main module",
            },
        ]

        changes = self.p4_client.get_changes("//depot/...", max_changes=20)

        # Verify p4 changes command was called with correct args
        mock_p4.run.assert_called_once_with("changes", "-m", "20", "-l", "//depot/...")

        # Check results
        assert len(changes) == 2
        assert changes[0]["change"] == "12346"
        assert changes[0]["user"] == "janedoe"
        assert changes[1]["change"] == "12345"
        assert changes[1]["user"] == "johndoe"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_changes_with_end_cl(self, mock_p4_class):
        """Test get_changes filters by end changelist"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        mock_p4.run.return_value = [
            {
                "change": "12346",
                "user": "janedoe",
                "client": "jane-ws",
                "time": "1609545600",
                "desc": "Add utils",
            },
            {
                "change": "12345",
                "user": "johndoe",
                "client": "john-ws",
                "time": "1609459200",
                "desc": "Fix bug",
            },
        ]

        changes = self.p4_client.get_changes("//depot/...", max_changes=20, end_cl=12346)

        # Verify -e flag was used for end_cl
        mock_p4.run.assert_called_once_with(
            "changes", "-m", "20", "-l", "-e", "12346", "//depot/..."
        )

        assert len(changes) == 2

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_changes_with_start_cl(self, mock_p4_class):
        """Test get_changes filters by start changelist (exclusive)"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock returns changes 12345, 12346, 12347
        mock_p4.run.return_value = [
            {
                "change": "12347",
                "user": "user3",
                "client": "ws3",
                "time": "1609632000",
                "desc": "Change 3",
            },
            {
                "change": "12346",
                "user": "user2",
                "client": "ws2",
                "time": "1609545600",
                "desc": "Change 2",
            },
            {
                "change": "12345",
                "user": "user1",
                "client": "ws1",
                "time": "1609459200",
                "desc": "Change 1",
            },
        ]

        # Filter out changes <= 12345 (only want changes > 12345)
        changes = self.p4_client.get_changes("//depot/...", max_changes=20, start_cl=12345)

        # Verify no -s flag (Perforce doesn't have one)
        # Client-side filtering is done for start_cl
        assert len(changes) == 2
        assert changes[0]["change"] == "12347"
        assert changes[1]["change"] == "12346"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_changes_with_range(self, mock_p4_class):
        """Test get_changes filters by start and end changelist range"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        mock_p4.run.return_value = [
            {
                "change": "12347",
                "user": "user3",
                "client": "ws3",
                "time": "1609632000",
                "desc": "Change 3",
            },
            {
                "change": "12346",
                "user": "user2",
                "client": "ws2",
                "time": "1609545600",
                "desc": "Change 2",
            },
            {
                "change": "12345",
                "user": "user1",
                "client": "ws1",
                "time": "1609459200",
                "desc": "Change 1",
            },
        ]

        # Get changes in range (12345, 12348] = 12346, 12347
        changes = self.p4_client.get_changes(
            "//depot/...", max_changes=20, start_cl=12345, end_cl=12348
        )

        # Should filter out 12345 (exclusive lower bound)
        assert len(changes) == 2
        assert changes[0]["change"] == "12347"
        assert changes[1]["change"] == "12346"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_changes_type_validation(self, mock_p4_class):
        """Test get_changes validates that start_cl and end_cl are integers"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Test with string start_cl
        with pytest.raises(TypeError, match="start_cl must be an integer"):
            self.p4_client.get_changes("//depot/...", start_cl="12345")  # type: ignore[arg-type]

        # Test with string end_cl
        with pytest.raises(TypeError, match="end_cl must be an integer"):
            self.p4_client.get_changes("//depot/...", end_cl="12346")  # type: ignore[arg-type]

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_check_file_exists(self, mock_p4_class):
        """Test check_file returns file info when file exists"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock files response
        mock_p4.run.return_value = [
            {
                "depotFile": "//depot/src/main.py",
                "rev": "5",
                "change": "12345",
                "action": "edit",
            }
        ]

        result = self.p4_client.check_file(self.repo, "src/main.py", None)

        # Verify p4 files command was called
        mock_p4.run.assert_called_once_with("files", "//depot/src/main.py")

        # Check result
        assert result is not None
        assert isinstance(result, dict)
        assert result["depotFile"] == "//depot/src/main.py"
        assert result["rev"] == "5"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_check_file_not_exists(self, mock_p4_class):
        """Test check_file returns None when file doesn't exist"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock P4Exception for non-existent file
        from sentry.integrations.perforce.p4protocol import P4Exception

        mock_p4.run.side_effect = P4Exception("File not found")

        result = self.p4_client.check_file(self.repo, "src/missing.py", None)

        # Should return None for missing file
        assert result is None

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_check_file_empty_result(self, mock_p4_class):
        """Test check_file returns None when result has no depotFile"""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        # Mock empty result (just warnings)
        mock_p4.run.return_value = [{"warning": "File is not in depot"}]

        result = self.p4_client.check_file(self.repo, "src/file.py", None)

        # Should return None when no depotFile in result
        assert result is None

    def test_build_depot_path_relative(self) -> None:
        """Test build_depot_path with relative path"""
        # Test with simple relative path
        path = self.p4_client.build_depot_path(self.repo, "app/services/processor.py")
        assert path == "//depot/app/services/processor.py"

        # Test with depot name in path (should strip it)
        path = self.p4_client.build_depot_path(self.repo, "depot/app/services/processor.py")
        assert path == "//depot/app/services/processor.py"

    def test_build_depot_path_absolute(self) -> None:
        """Test build_depot_path with absolute path"""
        path = self.p4_client.build_depot_path(self.repo, "//depot/app/services/processor.py")
        assert path == "//depot/app/services/processor.py"

    def test_build_depot_path_with_stream(self) -> None:
        """Test build_depot_path with stream parameter"""
        path = self.p4_client.build_depot_path(
            self.repo, "app/services/processor.py", stream="main"
        )
        assert path == "//depot/main/app/services/processor.py"

    def test_build_depot_path_with_revision(self) -> None:
        """Test build_depot_path preserves #revision syntax"""
        # Test with relative path
        path = self.p4_client.build_depot_path(self.repo, "app/services/processor.py#42")
        assert path == "//depot/app/services/processor.py#42"

        # Test with absolute path
        path = self.p4_client.build_depot_path(self.repo, "//depot/app/main.cpp#1")
        assert path == "//depot/app/main.cpp#1"

        # Test with stream and revision
        path = self.p4_client.build_depot_path(self.repo, "app/main.cpp#5", stream="dev")
        assert path == "//depot/dev/app/main.cpp#5"

    def test_build_depot_path_nested_depot(self) -> None:
        """Test build_depot_path with nested depot paths"""
        nested_repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="//depot/game/project",
            provider="integrations:perforce",
            external_id="//depot/game/project",
            integration_id=self.integration.id,
            config={"depot_path": "//depot/game/project"},
        )

        path = self.p4_client.build_depot_path(nested_repo, "src/main.cpp")
        assert path == "//depot/game/project/src/main.cpp"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_connect_writes_p4config_file(self, mock_p4_class):
        """_connect() must write a config file named by P4CONFIG with P4TRUST and P4TICKETS."""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        captured_cwd = None
        captured_config = None

        def capture_state():
            nonlocal captured_cwd, captured_config
            captured_cwd = mock_p4.cwd
            config_filename = os.environ.get("P4CONFIG", ".p4config")
            config_path = f"{captured_cwd}/{config_filename}"
            if os.path.exists(config_path):
                with open(config_path) as f:
                    captured_config = f.read()

        mock_p4.connect.side_effect = capture_state

        with self.p4_client._connect():
            pass

        # p4.cwd must point to an isolated temp dir
        assert captured_cwd is not None
        assert "sentry-p4-" in captured_cwd

        # config file must contain P4TRUST and P4TICKETS pointing into that dir
        assert captured_config is not None
        assert f"P4TRUST={captured_cwd}/.p4trust" in captured_config
        assert f"P4TICKETS={captured_cwd}/.p4tickets" in captured_config

        # ticket_file property must also be set on the P4 instance
        ticket_path = mock_p4.ticket_file
        assert "sentry-p4-" in ticket_path
        assert ticket_path.endswith("/.p4tickets")

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_connect_respects_custom_p4config_filename(self, mock_p4_class):
        """_connect() must use the actual P4CONFIG env value as the config filename."""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        captured_cwd = None
        captured_config = None

        def capture_state():
            nonlocal captured_cwd, captured_config
            captured_cwd = mock_p4.cwd
            config_path = f"{captured_cwd}/custom-p4.conf"
            if os.path.exists(config_path):
                with open(config_path) as f:
                    captured_config = f.read()

        mock_p4.connect.side_effect = capture_state

        with mock.patch.dict(os.environ, {"P4CONFIG": "custom-p4.conf"}):
            with self.p4_client._connect():
                pass

        assert captured_config is not None
        assert "P4TRUST=" in captured_config
        assert "P4TICKETS=" in captured_config

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_connect_does_not_use_set_env(self, mock_p4_class):
        """_connect() must NOT use set_env (it only works on Windows/macOS, not Linux)."""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        with self.p4_client._connect():
            pass

        mock_p4.set_env.assert_not_called()

    def test_p4config_isolates_p4trust_per_instance(self) -> None:
        """Verify P4CONFIG + p4.cwd gives each P4 instance its own P4TRUST."""
        import shutil
        import tempfile

        from sentry.integrations.perforce.p4protocol import P4

        os.environ.setdefault("P4CONFIG", ".p4config")

        dir_a = tempfile.mkdtemp(prefix="sentry-p4-test-a-")
        dir_b = tempfile.mkdtemp(prefix="sentry-p4-test-b-")
        try:
            with open(f"{dir_a}/.p4config", "w") as f:
                f.write(f"P4TRUST={dir_a}/.p4trust\n")
            with open(f"{dir_b}/.p4config", "w") as f:
                f.write(f"P4TRUST={dir_b}/.p4trust\n")

            p4a = P4()
            p4a.cwd = dir_a
            p4b = P4()
            p4b.cwd = dir_b

            assert p4a.env("P4TRUST") == f"{dir_a}/.p4trust"
            assert p4b.env("P4TRUST") == f"{dir_b}/.p4trust"
        finally:
            shutil.rmtree(dir_a)
            shutil.rmtree(dir_b)

    def test_module_level_p4config_is_set(self) -> None:
        """Verify that importing the client module sets P4CONFIG."""
        assert os.environ.get("P4CONFIG") == ".p4config"

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_connect_sets_charset_for_unicode_server(self, mock_p4_class):
        """_connect() must set p4.charset before connect() when configured for a Unicode server."""
        p4_stub = _P4AttributeRecorder()
        mock_p4_class.return_value = p4_stub

        unicode_integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce Unicode",
            external_id="perforce-unicode",
            metadata={
                "p4port": "ssl:perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
                "auth_type": "password",
                "charset": "utf8",
            },
        )
        unicode_org_integration = unicode_integration.organizationintegration_set.first()
        client = PerforceClient(
            integration=unicode_integration, org_integration=unicode_org_integration
        )

        with client._connect():
            pass

        # charset must be set, and it must be set before connect() so the
        # server sees it during the initial handshake.
        assert p4_stub.charset == "utf8"
        assert "charset" in p4_stub.attrs_set_before_connect

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_connect_does_not_set_charset_for_non_unicode_server(self, mock_p4_class):
        """_connect() must NOT touch p4.charset when configured for a non-Unicode server."""
        p4_stub = _P4AttributeRecorder()
        mock_p4_class.return_value = p4_stub

        # Default fixture client has no charset → non-Unicode server.
        with self.p4_client._connect():
            pass

        assert "charset" not in p4_stub.attrs_set

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_connect_does_not_set_charset_when_explicitly_none(self, mock_p4_class):
        """The 'none' sentinel must behave the same as not setting charset at all."""
        p4_stub = _P4AttributeRecorder()
        mock_p4_class.return_value = p4_stub

        none_integration = self.create_integration(
            organization=self.organization,
            provider="perforce",
            name="Perforce None",
            external_id="perforce-none-charset",
            metadata={
                "p4port": "perforce.example.com:1666",
                "user": "testuser",
                "password": "testpass",
                "auth_type": "password",
                "charset": "none",
            },
        )
        none_org_integration = none_integration.organizationintegration_set.first()
        client = PerforceClient(integration=none_integration, org_integration=none_org_integration)

        with client._connect():
            pass

        assert "charset" not in p4_stub.attrs_set

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_connect_translates_unicode_server_error(self, mock_p4_class):
        """Connecting to a Unicode server without a charset must surface an actionable error."""
        from sentry.integrations.perforce.p4protocol import P4Exception
        from sentry.shared_integrations.exceptions import ApiError

        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4
        mock_p4.connect.side_effect = P4Exception(
            "Unicode server permits only unicode enabled clients."
        )

        with pytest.raises(ApiError) as exc_info:
            with self.p4_client._connect():
                pass

        # The user-facing message must point at the fix, not just the raw P4 string.
        message = str(exc_info.value)
        assert "Unicode mode" in message
        assert "Server Encoding" in message

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_unicode_error_at_login_is_translated(self, mock_p4_class):
        """The pure-Python client surfaces the Unicode error at run_login(), not
        connect(); it must still yield the Server Encoding guidance rather than a
        misleading password/ticket error."""
        from sentry.integrations.perforce.p4protocol import P4Exception
        from sentry.shared_integrations.exceptions import ApiError

        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4
        mock_p4.run_login.side_effect = P4Exception(
            "Unicode server permits only unicode enabled clients."
        )

        with pytest.raises(ApiError) as exc_info:
            with self.p4_client._connect():
                pass

        message = str(exc_info.value)
        assert "Unicode mode" in message
        assert "Server Encoding" in message
        assert "password" not in message.lower()

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_file_binary_returns_empty(self, mock_p4_class):
        """Binary depot files return empty rather than 500-ing or yielding mojibake."""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4
        mock_p4.run.return_value = [
            {"depotFile": "//depot/logo.bin", "type": "binary", "fileSize": "15"},
            b"\x89PNG\r\n\x1a\n\x00\x01\x02\x03",
        ]

        assert self.p4_client.get_file(self.repo, "logo.bin", None) == ""

    @mock.patch("sentry.integrations.perforce.client.P4")
    def test_get_file_binary_variants_return_empty(self, mock_p4_class):
        """Legacy/modified binary file types must also be treated as binary."""
        mock_p4 = mock.Mock()
        mock_p4_class.return_value = mock_p4

        for file_type in ("xbinary", "ubinary", "uxbinary", "binary+x", "apple", "resource"):
            mock_p4.run.return_value = [
                {"depotFile": "//depot/logo.bin", "type": file_type, "fileSize": "15"},
                b"\x89PNG\r\n\x1a\n\x00\x01\x02\x03",
            ]
            assert self.p4_client.get_file(self.repo, "logo.bin", None) == "", file_type

    def test_parse_fields_rejects_malformed_message(self) -> None:
        """A truncated/malformed server message raises P4Exception, not a bare ValueError."""
        from sentry.integrations.perforce.p4protocol.protocol import P4, P4Exception

        with pytest.raises(P4Exception):
            P4._parse_fields(b"name-without-terminator")

    def test_is_ssl_transport_detection(self) -> None:
        """TLS is detected by the transport prefix case-insensitively, and only
        when a transport is present — a host named 'ssl...' is plain TCP."""
        from sentry.integrations.perforce.p4protocol.protocol import P4

        def is_ssl(port: str) -> bool:
            p4 = P4()
            p4.port = port
            return p4._is_ssl()

        assert is_ssl("ssl:perforce.example.com:1666") is True
        assert is_ssl("SSL:perforce.example.com:1666") is True
        assert is_ssl("Ssl6:perforce.example.com:1666") is True
        assert is_ssl("tcp:perforce.example.com:1666") is False
        assert is_ssl("perforce.example.com:1666") is False
        assert is_ssl("sslhost.example.com:1666") is False

    def test_handle_message_tolerates_non_numeric_code(self) -> None:
        """A non-numeric server message code is surfaced as an error rather than
        crashing the dispatch loop with a ValueError."""
        from sentry.integrations.perforce.p4protocol.protocol import P4

        p4 = P4()
        errors: list[str] = []
        p4._handle_message({b"code0": b"not-a-number", b"fmt0": b"kaboom"}, errors)
        assert errors == ["kaboom"]

    def test_write_wraps_socket_errors(self) -> None:
        """A mid-stream socket error surfaces as P4Exception, not a raw OSError
        that the callers (which catch only P4Exception) would let escape as a 500."""
        from sentry.integrations.perforce.p4protocol.protocol import P4, P4Exception

        p4 = P4()
        p4._sock = mock.Mock()
        p4._sock.sendall.side_effect = OSError("broken pipe")
        with pytest.raises(P4Exception):
            p4._write(b"data")

    def test_read_message_rejects_oversized_length(self) -> None:
        """A hostile/oversized announced message length is rejected up front."""
        import struct

        from sentry.integrations.perforce.p4protocol.protocol import (
            _MAX_MESSAGE_SIZE,
            P4,
            P4Exception,
        )

        p4 = P4()
        length = _MAX_MESSAGE_SIZE + 1
        lb = struct.pack("<I", length)
        p4._buf = bytes([lb[0] ^ lb[1] ^ lb[2] ^ lb[3]]) + lb
        with pytest.raises(P4Exception):
            p4._read_message()

    def test_dispatch_ignores_progress_rpc(self) -> None:
        """A server-emitted client-Progress meter must not abort the operation."""
        from sentry.integrations.perforce.p4protocol.protocol import P4

        p4 = P4()
        with mock.patch.object(
            p4,
            "_read_message",
            side_effect=[
                {b"func": b"client-Progress", b"desc": b"copying", b"position": b"1"},
                {b"func": b"client-OutputText", b"data": b"hello"},
                {b"func": b"release"},
            ],
        ):
            assert p4._dispatch() == [b"hello"]

    def test_dispatch_fails_closed_on_unknown_rpc(self) -> None:
        """Genuinely unknown server RPCs fail closed rather than being ignored silently."""
        from sentry.integrations.perforce.p4protocol.protocol import P4, P4Exception

        p4 = P4()
        with mock.patch.object(
            p4,
            "_read_message",
            side_effect=[{b"func": b"client-SomeBrandNewRpc"}],
        ):
            with pytest.raises(P4Exception):
                p4._dispatch()


class _P4AttributeRecorder:
    """
    Minimal stand-in for the P4Python `P4` object that records every attribute
    assignment so tests can assert exactly which fields `_connect()` set on the
    client (e.g. that `charset` was — or was not — assigned before `connect()`).

    A plain `Mock` is unsuitable here: reading `mock.charset` after the fact
    auto-creates a child Mock, making it indistinguishable from a real
    assignment. This stub gives us a deterministic set of assignments instead.
    """

    # Declared at class scope so mypy can see them — runtime assignment happens
    # via object.__setattr__ inside __init__ to bypass our custom __setattr__.
    attrs_set: set[str]
    attrs_set_before_connect: set[str]
    _connect_called: bool
    # Set dynamically by `_connect()` when the integration is configured for a
    # Unicode server. Declared so tests can read `p4_stub.charset` without
    # tripping mypy's attr-defined check.
    charset: str

    def __init__(self) -> None:
        object.__setattr__(self, "attrs_set", set())
        object.__setattr__(self, "attrs_set_before_connect", set())
        object.__setattr__(self, "_connect_called", False)

    def __setattr__(self, name: str, value: object) -> None:
        self.attrs_set.add(name)
        if not self._connect_called:
            self.attrs_set_before_connect.add(name)
        object.__setattr__(self, name, value)

    def connect(self) -> None:
        object.__setattr__(self, "_connect_called", True)

    def disconnect(self) -> None:
        pass

    def connected(self) -> bool:
        return True

    def run(self, *args: object, **kwargs: object) -> list:
        return []

    def run_login(self) -> None:
        pass

    def run_trust(self, *args: object) -> None:
        pass
