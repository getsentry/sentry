import uuid
from unittest.mock import MagicMock, patch

import orjson

from sentry.seer.agent.client_models import (
    AgentFilePatch,
    Artifact,
    FilePatch,
    MemoryBlock,
    Message,
    PendingUserInput,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.endpoints.organization_seer_editor_sessions import (
    OrganizationSeerEditorSessionsEndpoint,
)
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.seer.models.run import SeerRunMirrorStatus
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.types.ratelimit import RateLimitCategory


@with_feature("organizations:seer-vscode")
@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
@with_feature("organizations:gen-ai-consent-flow-removal")
class OrganizationSeerEditorSessionsEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = f"/api/0/organizations/{self.organization.slug}/seer/editor/sessions/"

    def create_editor_run(
        self,
        *,
        user_id: int | None = None,
        source: str = "vscode",
        seer_run_state_id: int | None = 123,
        mirror_status: str = SeerRunMirrorStatus.LIVE,
        project=None,
    ):
        run = self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=seer_run_state_id,
            user_id=user_id if user_id is not None else self.user.id,
            mirror_status=mirror_status,
        )
        self.create_seer_agent_run(
            run=run,
            source=source,
            extras={"category_value": "editor-category"},
            project=project,
        )
        return run

    @patch(
        "sentry.seer.endpoints.organization_seer_editor_sessions.SeerAgentOperator.trigger_agent"
    )
    def test_post_creates_owner_scoped_vscode_session(self, mock_trigger: MagicMock) -> None:
        def create_run(**kwargs):
            run = self.create_editor_run()
            return run.seer_run_state_id

        mock_trigger.side_effect = create_run

        response = self.client.post(
            self.collection_url,
            {
                "message": "Fix this issue",
                "issueId": str(self.group.id),
                "editorContext": {"activeFile": "src/example.py"},
            },
            format="json",
        )

        assert response.status_code == 201
        assert uuid.UUID(response.data["id"])
        assert response.data == {
            "id": response.data["id"],
            "status": "running",
            "messages": [],
            "pendingInput": None,
            "patches": [],
            "artifacts": [],
            "errors": [],
            "error": None,
            "links": {"issue": None, "pullRequests": []},
            "updatedAt": response.data["updatedAt"],
        }
        assert mock_trigger.call_args.kwargs["category_key"] == SeerEntrypointKey.VSCODE.value
        assert mock_trigger.call_args.kwargs["user"].id == self.user.id
        assert mock_trigger.call_args.kwargs["group"] == self.group
        assert mock_trigger.call_args.kwargs["prompt"] == "Fix this issue"
        assert orjson.loads(mock_trigger.call_args.kwargs["on_page_context"]) == {
            "activeFile": "src/example.py"
        }

    @patch("sentry.seer.endpoints.organization_seer_editor_sessions.SeerAgentClient")
    def test_get_returns_narrow_editor_state(self, mock_client_class: MagicMock) -> None:
        run = self.create_editor_run()
        mock_client_class.return_value.get_run.return_value = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="message-1",
                    message=Message(role="assistant", content="Apply this patch"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=[Artifact(key="evidence", data={"summary": "cause"}, reason="done")],
                    merged_file_patches=[
                        AgentFilePatch(
                            repo_name="example/repo",
                            patch=FilePatch(path="src/example.py", type="M", added=1, removed=1),
                            diff="@@ -1 +1 @@\n-old\n+new",
                        )
                    ],
                )
            ],
            status="awaiting_user_input",
            updated_at="2024-01-01T00:00:01Z",
            pending_user_input=PendingUserInput(
                id="input-1", input_type="file_change_approval", data={"paths": ["src/example.py"]}
            ),
            repo_pr_states={
                "example/repo": RepoPRState(
                    repo_name="example/repo", pr_url="https://example.com/pull/1"
                )
            },
            metadata={"private": True},
        )

        response = self.client.get(f"{self.collection_url}{run.uuid}/")

        assert response.status_code == 200
        assert response.data == {
            "id": str(run.uuid),
            "status": "waiting_for_user",
            "messages": [
                {
                    "id": "message-1",
                    "role": "assistant",
                    "content": "Apply this patch",
                    "timestamp": "2024-01-01T00:00:00Z",
                    "loading": False,
                }
            ],
            "pendingInput": {
                "id": "input-1",
                "type": "file_change_approval",
                "data": {"paths": ["src/example.py"]},
            },
            "patches": [
                {
                    "repository": "example/repo",
                    "path": "src/example.py",
                    "type": "M",
                    "diff": "@@ -1 +1 @@\n-old\n+new",
                    "added": 1,
                    "removed": 1,
                }
            ],
            "artifacts": [{"key": "evidence", "data": {"summary": "cause"}, "reason": "done"}],
            "errors": [],
            "error": None,
            "links": {"issue": None, "pullRequests": ["https://example.com/pull/1"]},
            "updatedAt": "2024-01-01T00:00:01Z",
        }
        assert "blocks" not in response.data
        assert "metadata" not in response.data

    def test_get_rejects_numeric_legacy_id(self) -> None:
        self.create_editor_run()

        response = self.client.get(f"{self.collection_url}123/")

        assert response.status_code == 400
        assert response.data == {"detail": "Invalid session ID."}

    def test_get_rejects_another_users_session(self) -> None:
        other_user = self.create_user()
        run = self.create_editor_run(user_id=other_user.id)

        response = self.client.get(f"{self.collection_url}{run.uuid}/")

        assert response.status_code == 404

    def test_get_rejects_non_vscode_session(self) -> None:
        run = self.create_editor_run(source="chat")

        response = self.client.get(f"{self.collection_url}{run.uuid}/")

        assert response.status_code == 404

    @patch(
        "sentry.seer.endpoints.organization_seer_editor_sessions.SeerAgentOperator.trigger_agent",
        return_value=123,
    )
    def test_post_message_continues_owned_session(self, mock_trigger: MagicMock) -> None:
        run = self.create_editor_run()

        response = self.client.post(
            f"{self.collection_url}{run.uuid}/messages/",
            {
                "message": "Try another approach",
                "editorContext": {"activeFile": "src/example.py"},
            },
            format="json",
        )

        assert response.status_code == 202
        assert response.data["id"] == str(run.uuid)
        assert response.data["status"] == "running"
        assert response.data["messages"] == []
        assert response.data["patches"] == []
        assert response.data["errors"] == []
        assert response.data["error"] is None
        assert mock_trigger.call_args.kwargs["category_value"] == "editor-category"
        assert mock_trigger.call_args.kwargs["run_id"] == 123
        assert orjson.loads(mock_trigger.call_args.kwargs["on_page_context"]) == {
            "activeFile": "src/example.py"
        }

    @patch("sentry.seer.endpoints.organization_seer_editor_sessions.make_signed_seer_api_request")
    def test_post_action_forwards_allowlisted_user_input(self, mock_request: MagicMock) -> None:
        run = self.create_editor_run()
        mock_request.return_value.status = 200

        response = self.client.post(
            f"{self.collection_url}{run.uuid}/actions/",
            {
                "type": "user_input_response",
                "inputId": "input-1",
                "responseData": {"approved": True},
            },
            format="json",
        )

        assert response.status_code == 202
        assert response.data["status"] == "running"
        assert response.data["messages"] == []
        body = orjson.loads(mock_request.call_args.args[2])
        assert body == {
            "run_id": 123,
            "organization_id": self.organization.id,
            "payload": {
                "type": "user_input_response",
                "input_id": "input-1",
                "response_data": {"approved": True},
            },
        }

    def test_post_action_rejects_unknown_action(self) -> None:
        run = self.create_editor_run()

        response = self.client.post(
            f"{self.collection_url}{run.uuid}/actions/",
            {"type": "run_shell_command"},
            format="json",
        )

        assert response.status_code == 400

    def test_post_action_rejects_create_pr(self) -> None:
        run = self.create_editor_run()

        response = self.client.post(
            f"{self.collection_url}{run.uuid}/actions/",
            {"type": "create_pr", "repoName": "example/repo"},
            format="json",
        )

        assert response.status_code == 400

    def test_post_action_rejects_select_solution(self) -> None:
        run = self.create_editor_run()

        response = self.client.post(
            f"{self.collection_url}{run.uuid}/actions/",
            {"type": "select_solution"},
            format="json",
        )

        assert response.status_code == 400

    def create_editor_run_without_project_access(self):
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member", teams=[])
        run = self.create_editor_run(user_id=member.id, project=self.project)
        self.login_as(member)
        return run

    @patch("sentry.seer.endpoints.organization_seer_editor_sessions.SeerAgentClient")
    def test_get_rejects_revoked_project_access(self, mock_client_class: MagicMock) -> None:
        run = self.create_editor_run_without_project_access()

        response = self.client.get(f"{self.collection_url}{run.uuid}/")

        assert response.status_code == 403
        mock_client_class.assert_not_called()

    @patch(
        "sentry.seer.endpoints.organization_seer_editor_sessions.SeerAgentOperator.trigger_agent"
    )
    def test_message_rejects_revoked_project_access(self, mock_trigger: MagicMock) -> None:
        run = self.create_editor_run_without_project_access()

        response = self.client.post(
            f"{self.collection_url}{run.uuid}/messages/",
            {"message": "Continue"},
            format="json",
        )

        assert response.status_code == 403
        mock_trigger.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_editor_sessions.make_signed_seer_api_request")
    def test_action_rejects_revoked_project_access(self, mock_request: MagicMock) -> None:
        run = self.create_editor_run_without_project_access()

        response = self.client.post(
            f"{self.collection_url}{run.uuid}/actions/",
            {
                "type": "user_input_response",
                "inputId": "input-1",
                "responseData": {"approved": True},
            },
            format="json",
        )

        assert response.status_code == 403
        mock_request.assert_not_called()

    def test_feature_flag_is_required(self) -> None:
        with self.feature({"organizations:seer-vscode": False}):
            response = self.client.post(
                self.collection_url,
                {"message": "Start", "issueId": str(self.group.id)},
                format="json",
            )

        assert response.status_code == 403

    @patch("sentry.seer.endpoints.organization_seer_editor_sessions.SeerAgentClient")
    def test_get_processing_session_returns_complete_pending_shape(
        self, mock_client_class: MagicMock
    ) -> None:
        run = self.create_editor_run(
            seer_run_state_id=None, mirror_status=SeerRunMirrorStatus.PENDING
        )

        response = self.client.get(f"{self.collection_url}{run.uuid}/")

        assert response.status_code == 200
        assert response.data == {
            "id": str(run.uuid),
            "status": "pending",
            "messages": [],
            "pendingInput": None,
            "patches": [],
            "artifacts": [],
            "errors": [],
            "error": None,
            "links": {"issue": None, "pullRequests": []},
            "updatedAt": run.last_triggered_at.isoformat(),
        }
        mock_client_class.assert_not_called()

    @patch("sentry.seer.endpoints.organization_seer_editor_sessions.SeerAgentClient")
    def test_get_failed_session_returns_complete_failed_shape(
        self, mock_client_class: MagicMock
    ) -> None:
        run = self.create_editor_run(mirror_status=SeerRunMirrorStatus.FAILED)

        response = self.client.get(f"{self.collection_url}{run.uuid}/")

        assert response.status_code == 200
        assert response.data == {
            "id": str(run.uuid),
            "status": "failed",
            "messages": [],
            "pendingInput": None,
            "patches": [],
            "artifacts": [],
            "errors": ["Seer could not start this session."],
            "error": "Seer could not start this session.",
            "links": {"issue": None, "pullRequests": []},
            "updatedAt": run.last_triggered_at.isoformat(),
        }
        mock_client_class.assert_not_called()

    def test_uses_seer_chat_rate_limits(self) -> None:
        assert OrganizationSeerEditorSessionsEndpoint.enforce_rate_limit is True
        post_limits = OrganizationSeerEditorSessionsEndpoint.rate_limits.limit_overrides["POST"]
        get_limits = OrganizationSeerEditorSessionsEndpoint.rate_limits.limit_overrides["GET"]
        assert post_limits[RateLimitCategory.USER].limit == 25
        assert get_limits[RateLimitCategory.USER].limit == 100
