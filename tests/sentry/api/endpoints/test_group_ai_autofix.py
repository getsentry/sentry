from datetime import datetime
from unittest.mock import ANY, Mock, patch

from sentry.api.endpoints.group_ai_autofix import TIMEOUT_SECONDS
from sentry.autofix.utils import AutofixState, AutofixStatus
from sentry.models.group import Group
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:gen-ai-features")
class GroupAutofixEndpointTest(APITestCase, SnubaTestCase):
    def _get_url(self, group_id: int):
        return f"/api/0/issues/{group_id}/autofix/"

    def setUp(self):
        super().setUp()

        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    def test_ai_autofix_get_endpoint_with_autofix(self, mock_get_autofix_state):
        group = self.create_group()
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
        )

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert response.data["autofix"]["status"] == "PROCESSING"

        mock_get_autofix_state.assert_called_once_with(group_id=group.id)

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    def test_ai_autofix_get_endpoint_without_autofix(self, mock_get_autofix_state):
        group = self.create_group()
        mock_get_autofix_state.return_value = None

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is None

        mock_get_autofix_state.assert_called_once_with(group_id=group.id)

    @patch("sentry.api.endpoints.group_ai_autofix.get_autofix_state")
    @patch("sentry.api.endpoints.group_ai_autofix.get_sorted_code_mapping_configs")
    def test_ai_autofix_get_endpoint_repositories(
        self, mock_get_sorted_code_mapping_configs, mock_get_autofix_state
    ):
        group = self.create_group()
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request={"project_id": 456, "issue": {"id": 789}},
            updated_at=datetime.fromisoformat("2023-07-18T12:00:00Z"),
            status=AutofixStatus.PROCESSING,
        )

        class TestRepo:
            def __init__(self):
                self.url = "example.com"
                self.external_id = "id123"
                self.name = "test_repo"
                self.provider = "github"

        mock_get_sorted_code_mapping_configs.return_value = [
            Mock(repository=TestRepo(), default_branch="main"),
        ]

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert len(response.data["autofix"]["repositories"]) == 1
        assert response.data["autofix"]["repositories"][0]["default_branch"] == "main"

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_endpoint(self, mock_check_autofix_status, mock_call):
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

        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"instruction": "Yes", "event_id": event.event_id},
            format="json",
        )
        mock_call.assert_called_with(
            ANY,
            group,
            [
                {
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123",
                }
            ],
            ANY,
            "Yes",
            TIMEOUT_SECONDS,
            None,
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )
        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(args=[123], countdown=900)

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_event_id(self, mock_check_autofix_status, mock_call):
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

        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )
        mock_call.assert_called_with(
            ANY,
            group,
            [
                {
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123",
                }
            ],
            ANY,
            "Yes",
            TIMEOUT_SECONDS,
            None,
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )
        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(args=[123], countdown=900)

    @patch("sentry.models.Group.get_recommended_event_for_environments", return_value=None)
    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    @patch("sentry.tasks.autofix.check_autofix_status.apply_async")
    def test_ai_autofix_post_without_event_id_no_recommended_event(
        self, mock_check_autofix_status, mock_call, mock_event
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

        mock_call.return_value = 123  # Mocking the run_id returned by _call_autofix

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"instruction": "Yes"}, format="json"
        )
        mock_call.assert_called_with(
            ANY,
            group,
            [
                {
                    "provider": "integrations:github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123",
                }
            ],
            ANY,
            "Yes",
            TIMEOUT_SECONDS,
            None,
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )

        assert response.status_code == 202

        mock_check_autofix_status.assert_called_once_with(args=[123], countdown=900)

    @patch("sentry.models.Group.get_recommended_event_for_environments", return_value=None)
    @patch("sentry.models.Group.get_latest_event", return_value=None)
    def test_ai_autofix_post_without_event_id_error(
        self, mock_latest_event, mock_recommended_event
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

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    def test_ai_autofix_without_code_mapping(self, mock_call):
        release = self.create_release(project=self.project, version="1.0.0")

        self.create_repo(
            project=self.project,
            name="invalid-repo",
            provider="integrations:someotherprovider",
            external_id="123",
        )

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
        mock_call.assert_not_called()

        group = Group.objects.get(id=group.id)

        error_msg = "Found no Github repositories linked to this project. Please set up the Github Integration and code mappings if you haven't"

        assert response.status_code == 400  # Expecting a Bad Request response for invalid repo
        assert response.data["detail"] == error_msg

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    def test_ai_autofix_without_stacktrace(self, mock_call):
        release = self.create_release(project=self.project, version="1.0.0")

        # Creating a repository with a valid name 'getsentry/sentry'
        valid_repo = self.create_repo(
            project=self.project,
            name="getsentry/sentry",
            provider="integrations:github",
            external_id="123",
        )
        valid_repo.save()

        self.create_commit(project=self.project, release=release, key="1234", repo=valid_repo)

        data = load_data("python", timestamp=before_now(minutes=1))

        event = self.store_event(
            data={
                **data,
                "release": release.version,
                "exception": None,
                "stacktrace": None,
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
        mock_call.assert_not_called()

        group = Group.objects.get(id=group.id)

        error_msg = "Cannot fix issues without a stacktrace."

        assert response.status_code == 400  # Expecting a Bad Request response for invalid repo
        assert response.data["detail"] == error_msg
