from unittest.mock import ANY, patch

from sentry.api.endpoints.group_ai_autofix import TIMEOUT_SECONDS
from sentry.models.group import Group
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("projects:ai-autofix")
class GroupAutofixEndpointTest(APITestCase, SnubaTestCase):
    def _get_url(self, group_id: int):
        return f"/api/0/issues/{group_id}/autofix/"

    @patch(
        "sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_get_autofix_state",
        return_value={"status": "PROCESSING"},
    )
    def test_ai_autofix_get_endpoint_with_autofix(self, mock_autofix_state_call):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert response.data["autofix"]["status"] == "PROCESSING"

        mock_autofix_state_call.assert_called_once()
        mock_autofix_state_call.assert_called_with(group.id)

    @patch(
        "sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_get_autofix_state",
        return_value=None,
    )
    def test_ai_autofix_get_endpoint_without_autofix(self, mock_autofix_state_call):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is None

        mock_autofix_state_call.assert_called_once()
        mock_autofix_state_call.assert_called_with(group.id)

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    def test_ai_autofix_post_endpoint(self, mock_call):
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
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )
        assert response.status_code == 202

    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    def test_ai_autofix_post_without_event_id(self, mock_call):
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
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )
        assert response.status_code == 202

    @patch("sentry.models.Group.get_recommended_event_for_environments", return_value=None)
    @patch("sentry.api.endpoints.group_ai_autofix.GroupAutofixEndpoint._call_autofix")
    def test_ai_autofix_post_without_event_id_no_recommended_event(self, mock_call, mock_event):
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
        )

        actual_group_arg = mock_call.call_args[0][1]
        assert actual_group_arg.id == group.id

        serialized_event_arg = mock_call.call_args[0][3]
        assert any(
            [entry.get("type") == "exception" for entry in serialized_event_arg.get("entries", [])]
        )

        assert response.status_code == 202

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
