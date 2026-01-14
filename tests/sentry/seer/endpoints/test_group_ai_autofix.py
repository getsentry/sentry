from datetime import datetime
from unittest.mock import Mock, patch

from sentry.seer.autofix.autofix import TIMEOUT_SECONDS
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import AutofixState, CodebaseState
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

# Note: Detailed tests for the implementation of functions in seer/autofix.py
# have been moved to tests/sentry/seer/test_autofix.py
# This file focuses on testing the endpoint behavior rather than the implementation details.

pytestmark = [requires_snuba]


@with_feature("organizations:gen-ai-features")
@patch("sentry.seer.autofix.autofix.get_seer_org_acknowledgement", return_value=True)
class GroupAutofixEndpointTest(APITestCase, SnubaTestCase):
    def _get_url(self, group_id: int) -> str:
        return f"/api/0/issues/{group_id}/autofix/"

    def setUp(self) -> None:
        super().setUp()

        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    def test_ai_autofix_get_endpoint_with_autofix(
        self, mock_get_autofix_state, mock_get_seer_org_acknowledgement
    ):
        group = self.create_group()
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": group.organization.id,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
        )

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert response.data["autofix"]["status"] == "PROCESSING"
        assert "issue" not in response.data["autofix"]["request"]
        assert "trace_tree" not in response.data["autofix"]["request"]
        assert "profile" not in response.data["autofix"]["request"]
        assert "issue_summary" not in response.data["autofix"]["request"]

        mock_get_autofix_state.assert_called_once_with(
            group_id=group.id,
            check_repo_access=True,
            is_user_fetching=False,
            organization_id=group.organization.id,
        )

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    def test_ai_autofix_get_endpoint_without_autofix(
        self, mock_get_autofix_state, mock_get_seer_org_acknowledgement
    ):
        group = self.create_group()
        mock_get_autofix_state.return_value = None

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is None

        mock_get_autofix_state.assert_called_once_with(
            group_id=group.id,
            check_repo_access=True,
            is_user_fetching=False,
            organization_id=group.organization.id,
        )

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_repositories(
        self,
        mock_get_sorted_code_mapping_configs,
        mock_get_autofix_state,
        mock_get_seer_org_acknowledgement,
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": group.organization.id,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            codebases={
                "id123": CodebaseState(
                    repo_external_id="id123",
                    is_readable=True,
                    is_writeable=True,
                )
            },
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self):
                self.url = "example.com"
                self.external_id = "id123"
                self.name = "test_repo"
                self.provider = "github"
                self.integration_id = 42

        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=TestRepo(), default_branch="main"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert len(response.data["autofix"]["repositories"]) == 1
        repo = response.data["autofix"]["repositories"][0]
        assert repo["default_branch"] == "main"
        assert repo["name"] == "test_repo"
        assert repo["provider"] == "github"
        assert repo["external_id"] == "id123"
        assert repo["url"] == "example.com"
        assert repo["integration_id"] == 42
        assert repo["is_readable"] is True
        assert repo["is_writeable"] is True

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_multiple_repositories(
        self,
        mock_get_sorted_code_mapping_configs,
        mock_get_autofix_state,
        mock_get_seer_org_acknowledgement,
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": group.organization.id,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            codebases={
                "id123": CodebaseState(
                    repo_external_id="id123",
                    is_readable=True,
                    is_writeable=True,
                ),
                "id456": CodebaseState(
                    repo_external_id="id456",
                    is_readable=True,
                    is_writeable=False,
                ),
            },
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self, external_id, name, provider, url, integration_id):
                self.url = url
                self.external_id = external_id
                self.name = name
                self.provider = provider
                self.integration_id = integration_id

        repo1 = TestRepo("id123", "repo1", "github", "example.com/repo1", 42)
        repo2 = TestRepo("id456", "repo2", "gitlab", "example.com/repo2", 43)

        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=repo1, default_branch="main"),
            Mock(repository=repo2, default_branch="master"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert len(response.data["autofix"]["repositories"]) == 2

        repositories = sorted(
            response.data["autofix"]["repositories"], key=lambda x: x["integration_id"]
        )

        # Check first repo
        repo = repositories[0]
        assert repo["default_branch"] == "main"
        assert repo["name"] == "repo1"
        assert repo["provider"] == "github"
        assert repo["external_id"] == "id123"
        assert repo["url"] == "example.com/repo1"
        assert repo["integration_id"] == 42
        assert repo["is_readable"] is True
        assert repo["is_writeable"] is True

        # Check second repo
        repo = repositories[1]
        assert repo["default_branch"] == "master"
        assert repo["name"] == "repo2"
        assert repo["provider"] == "gitlab"
        assert repo["external_id"] == "id456"
        assert repo["url"] == "example.com/repo2"
        assert repo["integration_id"] == 43
        assert repo["is_readable"] is True
        assert repo["is_writeable"] is False

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_repository_not_in_codebase(
        self,
        mock_get_sorted_code_mapping_configs,
        mock_get_autofix_state,
        mock_get_seer_org_acknowledgement,
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": group.organization.id,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            codebases={
                "id123": CodebaseState(
                    repo_external_id="id123",
                    is_readable=True,
                    is_writeable=True,
                )
            },
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self, external_id):
                self.url = "example.com"
                self.external_id = external_id
                self.name = "test_repo"
                self.provider = "github"
                self.integration_id = 42

        # Create a repo with a different external_id than what's in the codebase
        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=TestRepo("different_id"), default_branch="main"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        # No repositories should be included since the external_id doesn't match
        assert len(response.data["autofix"]["repositories"]) == 0

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_no_codebases(
        self,
        mock_get_sorted_code_mapping_configs,
        mock_get_autofix_state,
        mock_get_seer_org_acknowledgement,
    ):
        group = self.create_group()
        autofix_state = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": group.organization.id,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
            # Empty codebases dictionary
            codebases={},
        )
        mock_get_autofix_state.return_value = autofix_state

        class TestRepo:
            def __init__(self):
                self.url = "example.com"
                self.external_id = "id123"
                self.name = "test_repo"
                self.provider = "github"
                self.integration_id = 42

        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=TestRepo(), default_branch="main"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        # Should have empty repositories list since there are no codebases
        assert len(response.data["autofix"]["repositories"]) == 0

    @patch("sentry.seer.explorer.utils.get_from_profiling_service")
    @patch("sentry.seer.autofix.autofix._get_profile_from_trace_tree")
    @patch("sentry.seer.autofix.autofix._call_autofix")
    @patch("sentry.seer.autofix.autofix._get_trace_tree_for_event")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_endpoint(
        self,
        mock_check_autofix_status,
        mock_get_trace_tree,
        mock_call,
        mock_get_profile,
        mock_get_from_profiling,
        mock_get_seer_org_acknowledgement,
    ):
        # Set up mock return values
        mock_get_trace_tree.return_value = None
        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "Yes", "event_id": event.event_id},
            format="json",
        )

        # Verify that _call_autofix was called once
        mock_call.assert_called_once()

        # Check individual parameters that we care about
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["group"].id == group.id  # Check that the group object matches

        # Check that the repos parameter contains the expected data
        expected_repo_fields = {
            "provider": "integrations:github",
            "owner": "getsentry",
            "name": "sentry",
            "external_id": "123",
        }
        assert any(
            all(repo.get(key) == value for key, value in expected_repo_fields.items())
            for repo in call_kwargs["repos"]
        )

        # Check that the instruction was passed correctly
        assert call_kwargs["instruction"] == "Yes"

        # Check other parameters
        assert call_kwargs["timeout_secs"] == TIMEOUT_SECONDS

        # Verify that the serialized event has an exception entry
        serialized_event_arg = call_kwargs["serialized_event"]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )

        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(
            args=[123, group.organization.id], countdown=900
        )

    @patch("sentry.seer.explorer.utils.get_from_profiling_service")
    @patch("sentry.seer.autofix.autofix._get_profile_from_trace_tree")
    @patch("sentry.seer.autofix.autofix._call_autofix")
    @patch("sentry.seer.autofix.autofix._get_trace_tree_for_event")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_code_mappings(
        self,
        mock_check_autofix_status,
        mock_get_trace_tree,
        mock_call,
        mock_get_profile,
        mock_get_from_profiling,
        mock_get_seer_org_acknowledgement,
    ):
        # Set up mock return values
        mock_get_trace_tree.return_value = None
        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        release = self.create_release(project=self.project, version="1.0.0")

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "Yes", "event_id": event.event_id},
            format="json",
        )

        # Verify that _call_autofix was called once
        mock_call.assert_called_once()

        # Check individual parameters that we care about
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["group"].id == group.id  # Check that the group object matches

        # Check that the repos parameter is an empty list (no code mappings)
        assert call_kwargs["repos"] == []

        # Check that the instruction was passed correctly
        assert call_kwargs["instruction"] == "Yes"

        # Check other parameters
        assert call_kwargs["timeout_secs"] == TIMEOUT_SECONDS

        # Verify that the serialized event has an exception entry
        serialized_event_arg = call_kwargs["serialized_event"]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )

        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(
            args=[123, group.organization.id], countdown=900
        )

    @patch("sentry.seer.explorer.utils.get_from_profiling_service")
    @patch("sentry.seer.autofix.autofix._get_profile_from_trace_tree")
    @patch("sentry.seer.autofix.autofix._call_autofix")
    @patch("sentry.seer.autofix.autofix._get_trace_tree_for_event")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_event_id(
        self,
        mock_check_autofix_status,
        mock_get_trace_tree,
        mock_call,
        mock_get_profile,
        mock_get_from_profiling,
        mock_get_seer_org_acknowledgement,
    ):
        # Set up mock return values
        mock_get_trace_tree.return_value = None
        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )

        # Verify that _call_autofix was called once
        mock_call.assert_called_once()

        # Check individual parameters that we care about
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["group"].id == group.id  # Check that the group object matches

        # Check that the repos parameter contains the expected data
        expected_repo_fields = {
            "provider": "integrations:github",
            "owner": "getsentry",
            "name": "sentry",
            "external_id": "123",
        }
        assert any(
            all(repo.get(key) == value for key, value in expected_repo_fields.items())
            for repo in call_kwargs["repos"]
        )

        # Check that the instruction was passed correctly
        assert call_kwargs["instruction"] == "Yes"

        # Check other parameters
        assert call_kwargs["timeout_secs"] == TIMEOUT_SECONDS

        # Verify that the serialized event has an exception entry
        serialized_event_arg = call_kwargs["serialized_event"]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )

        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(
            args=[123, group.organization.id], countdown=900
        )

    @patch("sentry.models.Group.get_recommended_event_for_environments", return_value=None)
    @patch("sentry.seer.explorer.utils.get_from_profiling_service")
    @patch("sentry.seer.autofix.autofix._call_autofix")
    @patch("sentry.seer.autofix.autofix._get_trace_tree_for_event")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_event_id_no_recommended_event(
        self,
        mock_check_autofix_status,
        mock_get_trace_tree,
        mock_call,
        mock_get_profiling,
        mock_event,
        mock_get_seer_org_acknowledgement,
    ):
        # Set up mock return values
        mock_get_trace_tree.return_value = None
        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )

        # Verify that _call_autofix was called once
        mock_call.assert_called_once()

        # Check individual parameters that we care about
        call_kwargs = mock_call.call_args.kwargs
        assert call_kwargs["group"].id == group.id  # Check that the group object matches

        # Check that the repos parameter contains the expected data
        expected_repo_fields = {
            "provider": "integrations:github",
            "owner": "getsentry",
            "name": "sentry",
            "external_id": "123",
        }
        assert any(
            all(repo.get(key) == value for key, value in expected_repo_fields.items())
            for repo in call_kwargs["repos"]
        )

        # Check that the instruction was passed correctly
        assert call_kwargs["instruction"] == "Yes"

        # Check other parameters
        assert call_kwargs["timeout_secs"] == TIMEOUT_SECONDS

        # Verify that the serialized event has an exception entry
        serialized_event_arg = call_kwargs["serialized_event"]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )

        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(
            args=[123, group.organization.id], countdown=900
        )

    @patch("sentry.models.Group.get_recommended_event_for_environments", return_value=None)
    @patch("sentry.models.Group.get_latest_event", return_value=None)
    def test_ai_autofix_post_without_event_id_error(
        self, mock_latest_event, mock_recommended_event, mock_get_seer_org_acknowledgement
    ):
        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        self.create_code_mapping(project=self.project, repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )
        assert response.status_code == 400

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.seer.endpoints.group_ai_autofix.cache")
    def test_ai_autofix_get_endpoint_cache_miss(
        self, mock_cache, mock_get_autofix_state, mock_get_seer_org_acknowledgement
    ):
        """Test that repo access is checked when cache is empty"""
        # Set up cache miss
        mock_cache.get.return_value = None

        # Set up mock autofix state
        mock_get_autofix_state.return_value = None

        url = self._get_url(self.group.id)
        self.login_as(user=self.user)

        response = self.client.get(url)

        # Verify response
        assert response.status_code == 200

        # Verify cache behavior - cache miss should trigger repo access check
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{self.group.id}")
        mock_get_autofix_state.assert_called_once_with(
            group_id=self.group.id,
            check_repo_access=True,
            is_user_fetching=False,
            organization_id=self.group.organization.id,
        )

        # Verify the cache was set with a 60-second timeout
        mock_cache.set.assert_called_once_with(
            f"autofix_access_check:{self.group.id}", True, timeout=60
        )

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.seer.endpoints.group_ai_autofix.cache")
    def test_ai_autofix_get_endpoint_cache_hit(
        self, mock_cache, mock_get_autofix_state, mock_get_seer_org_acknowledgement
    ):
        """Test that repo access is not checked when cache has a value"""
        # Set up cache hit
        mock_cache.get.return_value = True

        # Set up mock autofix state
        mock_get_autofix_state.return_value = None

        url = self._get_url(self.group.id)
        self.login_as(user=self.user)

        response = self.client.get(url)

        # Verify response
        assert response.status_code == 200

        # Verify cache behavior - cache hit should skip repo access check
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{self.group.id}")
        mock_get_autofix_state.assert_called_once_with(
            group_id=self.group.id,
            check_repo_access=False,
            is_user_fetching=False,
            organization_id=self.group.organization.id,
        )

        # Verify the cache was not set again
        mock_cache.set.assert_not_called()

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.seer.endpoints.group_ai_autofix.cache")
    def test_ai_autofix_get_endpoint_polling_behavior(
        self, mock_cache, mock_get_autofix_state, mock_get_seer_org_acknowledgement
    ):
        """Test that polling the endpoint only performs repository access checks once per minute"""
        group = self.create_group()
        url = self._get_url(group.id)
        self.login_as(user=self.user)

        # Mock the autofix state
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={
                "project_id": 456,
                "organization_id": group.organization.id,
                "issue": {"id": 789, "title": "Test Issue"},
                "repos": [],
            },
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
        )

        # Simulate first request (cache miss)
        mock_cache.get.return_value = None

        response1 = self.client.get(url)
        assert response1.status_code == 200

        # Verify first request behavior
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{group.id}")
        mock_get_autofix_state.assert_called_once_with(
            group_id=group.id,
            check_repo_access=True,
            is_user_fetching=False,
            organization_id=group.organization.id,
        )
        mock_cache.set.assert_called_once_with(f"autofix_access_check:{group.id}", True, timeout=60)

        # Reset mocks for second request
        mock_cache.reset_mock()
        mock_get_autofix_state.reset_mock()

        # Simulate second request within the 1-minute window (cache hit)
        mock_cache.get.return_value = True

        response2 = self.client.get(url)
        assert response2.status_code == 200

        # Verify second request behavior
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{group.id}")
        mock_get_autofix_state.assert_called_once_with(
            group_id=group.id,
            check_repo_access=False,
            is_user_fetching=False,
            organization_id=group.organization.id,
        )
        mock_cache.set.assert_not_called()

        # Reset mocks for third request
        mock_cache.reset_mock()
        mock_get_autofix_state.reset_mock()

        # Simulate third request after cache expiration (cache miss again)
        mock_cache.get.return_value = None

        response3 = self.client.get(url)
        assert response3.status_code == 200

        # Verify third request behavior - should be like the first request
        mock_cache.get.assert_called_once_with(f"autofix_access_check:{group.id}")
        mock_get_autofix_state.assert_called_once_with(
            group_id=group.id,
            check_repo_access=True,
            is_user_fetching=False,
            organization_id=group.organization.id,
        )
        mock_cache.set.assert_called_once_with(f"autofix_access_check:{group.id}", True, timeout=60)

    def test_ai_autofix_post_invalid_stopping_point_string(self, mock_get_seer_org_acknowledgement):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "test", "stopping_point": "invalid"},
            format="json",
        )

        assert response.status_code == 400
        assert "stoppingPoint" in response.data
        assert "not a valid choice" in str(response.data["stoppingPoint"])

    def test_ai_autofix_post_invalid_stopping_point_type(self, mock_get_seer_org_acknowledgement):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "test", "stopping_point": 123},
            format="json",
        )

        assert response.status_code == 400
        assert "stoppingPoint" in response.data
        assert "not a valid choice" in str(response.data["stoppingPoint"])


@with_feature("organizations:gen-ai-features")
@with_feature("organizations:seer-explorer")
@with_feature("organizations:autofix-on-explorer")
@patch("sentry.seer.autofix.autofix.get_seer_org_acknowledgement", return_value=True)
class GroupAutofixEndpointExplorerRoutingTest(APITestCase, SnubaTestCase):
    """Tests for feature flag routing to Explorer-based autofix."""

    def _get_url(self, group_id: int, mode: str | None = None) -> str:
        url = f"/api/0/issues/{group_id}/autofix/"
        if mode is not None:
            url = f"{url}?mode={mode}"
        return url

    def setUp(self) -> None:
        super().setUp()
        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)
        self.organization.flags.allow_joinleave = True
        self.organization.save()

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_explorer_state")
    def test_get_routes_to_explorer_with_both_flags(
        self, mock_get_explorer_state, mock_get_seer_org_acknowledgement
    ):
        """GET routes to explorer when both seer-explorer and autofix-on-explorer flags are enabled."""
        group = self.create_group()
        mock_get_explorer_state.return_value = None

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id, mode="explorer"), format="json")

        assert response.status_code == 200, response.data
        mock_get_explorer_state.assert_called_once_with(group.organization, group.id)

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    def test_get_routes_to_legacy_with_mode_param(
        self, mock_get_autofix_state, mock_get_seer_org_acknowledgement
    ):
        """GET routes to legacy when mode=legacy is in query params even with both flags enabled."""
        group = self.create_group()
        mock_get_autofix_state.return_value = None

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200, response.data
        mock_get_autofix_state.assert_called_once()

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_explorer")
    def test_post_routes_to_explorer_with_both_flags(
        self, mock_trigger_explorer, mock_get_seer_org_acknowledgement
    ):
        """POST routes to explorer when both seer-explorer and autofix-on-explorer flags are enabled."""
        group = self.create_group()
        mock_trigger_explorer.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id, mode="explorer"),
            data={"step": "root_cause"},
            format="json",
        )

        assert response.status_code == 202, response.data
        assert response.data["run_id"] == 123
        mock_trigger_explorer.assert_called_once()

    @patch("sentry.seer.autofix.autofix._call_autofix")
    @patch("sentry.seer.autofix.autofix._get_trace_tree_for_event")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_post_routes_to_legacy_with_mode_param(
        self,
        mock_check_autofix_status,
        mock_get_trace_tree,
        mock_call_autofix,
        mock_get_seer_org_acknowledgement,
    ):
        """POST routes to legacy when mode=legacy is in query params even with both flags enabled."""
        release = self.create_release(project=self.project, version="1.0.0")

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": {"values": [{"type": "exception", "data": {"values": []}}]},
            },
            project_id=self.project.id,
        )

        group = event.group

        mock_get_trace_tree.return_value = None
        mock_call_autofix.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "test"},
            format="json",
        )

        assert response.status_code == 202, response.data
        mock_call_autofix.assert_called_once()


@with_feature("organizations:gen-ai-features")
@with_feature("organizations:seer-explorer")
@patch("sentry.seer.autofix.autofix.get_seer_org_acknowledgement", return_value=True)
class GroupAutofixEndpointLegacyRoutingTest(APITestCase, SnubaTestCase):
    """Tests that endpoint routes to legacy when autofix-on-explorer flag is missing."""

    def _get_url(self, group_id: int) -> str:
        return f"/api/0/issues/{group_id}/autofix/"

    def setUp(self) -> None:
        super().setUp()
        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_state")
    def test_get_routes_to_legacy_without_autofix_on_explorer_flag(
        self, mock_get_autofix_state, mock_get_seer_org_acknowledgement
    ):
        """GET routes to legacy when autofix-on-explorer flag is missing."""
        group = self.create_group()
        mock_get_autofix_state.return_value = None

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200, response.data
        mock_get_autofix_state.assert_called_once()
