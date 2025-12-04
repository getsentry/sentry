from datetime import datetime, timezone
from unittest import mock

import pytest

from sentry.integrations.perforce.client import PerforceClient
from sentry.integrations.source_code_management.commit_context import SourceLineInfo
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class PerforceClientTest(TestCase):
    def setUp(self):
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
        from P4 import P4Exception

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
        from P4 import P4Exception

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

    def test_build_depot_path_relative(self):
        """Test build_depot_path with relative path"""
        # Test with simple relative path
        path = self.p4_client.build_depot_path(self.repo, "app/services/processor.py")
        assert path == "//depot/app/services/processor.py"

        # Test with depot name in path (should strip it)
        path = self.p4_client.build_depot_path(self.repo, "depot/app/services/processor.py")
        assert path == "//depot/app/services/processor.py"

    def test_build_depot_path_absolute(self):
        """Test build_depot_path with absolute path"""
        path = self.p4_client.build_depot_path(self.repo, "//depot/app/services/processor.py")
        assert path == "//depot/app/services/processor.py"

    def test_build_depot_path_with_stream(self):
        """Test build_depot_path with stream parameter"""
        path = self.p4_client.build_depot_path(
            self.repo, "app/services/processor.py", stream="main"
        )
        assert path == "//depot/main/app/services/processor.py"

    def test_build_depot_path_with_revision(self):
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

    def test_build_depot_path_nested_depot(self):
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
