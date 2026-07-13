import uuid
from unittest.mock import Mock, patch

from sentry.integrations.services.integration import RpcIntegration
from sentry.issues.action_log.types import TriggerAutofixAction
from sentry.seer.agent.client_models import MemoryBlock, Message, RepoPRState, SeerRunState
from sentry.seer.autofix.autofix_agent import AutofixStep, NoSeerQuotaException
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.github_perms import MissingGithubPermissions
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.skips import requires_snuba

# Note: Detailed tests for the implementation of functions in seer/autofix.py
# have been moved to tests/sentry/seer/test_autofix.py
# This file focuses on testing the endpoint behavior rather than the implementation details.

pytestmark = [requires_snuba]


@with_feature("organizations:gen-ai-features")
class GroupAutofixEndpointTest(APITestCase, SnubaTestCase):
    def _get_url(self, group_id: int) -> str:
        return f"/api/0/organizations/{self.organization.slug}/issues/{group_id}/autofix/"

    def setUp(self) -> None:
        super().setUp()
        self.organization.update_option("sentry:gen_ai_consent_v2024_11_14", True)
        self.organization.flags.allow_joinleave = True
        self.organization.save()

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_agent_state")
    def test_get_returns_state(self, mock_get_explorer_state):
        group = self.create_group()
        mock_get_explorer_state.return_value = None

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200, response.data
        mock_get_explorer_state.assert_called_once_with(group.organization, group.id)

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_agent_state")
    def test_get_includes_sentry_run_id(self, mock_get_explorer_state):
        group = self.create_group()
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=888)
        mock_get_explorer_state.return_value = SeerRunState(
            run_id=888,
            blocks=[],
            status="completed",
            updated_at="2023-07-18T12:00:00Z",
        )

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200, response.data
        assert response.data["autofix"]["run_id"] == 888
        assert response.data["autofix"]["sentry_run_id"] == str(run.uuid)

    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_agent_state")
    def test_get_handles_block_with_null_metadata(self, mock_get_explorer_state):
        group = self.create_group()
        mock_get_explorer_state.return_value = SeerRunState(
            run_id=888,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="No metadata", metadata=None),
                    timestamp="2023-07-18T12:00:00Z",
                )
            ],
            status="completed",
            updated_at="2023-07-18T12:00:00Z",
        )

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200, response.data
        assert response.data["autofix"]["blocks"][0]["message"]["metadata"] is None

    @patch("sentry.seer.endpoints.group_ai_autofix.get_out_of_date_github_permissions")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_agent_state")
    def test_get_no_warnings_when_no_missing_permissions(
        self, mock_get_explorer_state, mock_get_perms
    ):
        group = self.create_group()
        mock_get_explorer_state.return_value = SeerRunState(
            run_id=888,
            blocks=[],
            status="completed",
            updated_at="2023-07-18T12:00:00Z",
        )
        mock_get_perms.return_value = {}

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200, response.data
        assert response.data["autofix"]["warnings"] == []
        mock_get_perms.assert_called_once()

    @patch("sentry.seer.endpoints.group_ai_autofix.get_out_of_date_github_permissions")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_agent_state")
    def test_get_returns_github_permission_warnings(self, mock_get_explorer_state, mock_get_perms):
        group = self.create_group()
        mock_get_explorer_state.return_value = SeerRunState(
            run_id=888,
            blocks=[],
            status="completed",
            updated_at="2023-07-18T12:00:00Z",
        )
        mock_get_perms.return_value = {
            "getsentry/sentry": MissingGithubPermissions(
                integration=RpcIntegration(
                    id=42,
                    provider="github",
                    external_id="9999",
                    name="octocat",
                    metadata={},
                    status=0,
                ),
                missing_scopes=["contents"],
            )
        }

        self.login_as(user=self.user)
        response = self.client.get(self._get_url(group.id), format="json")

        assert response.status_code == 200, response.data
        assert response.data["autofix"]["warnings"] == [
            {
                "warning_type": "github_app_permissions",
                "repo_name": "getsentry/sentry",
                "installation_id": "9999",
            }
        ]

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_triggers_autofix_agent(self, mock_trigger_explorer):
        group = self.create_group()
        mock_trigger_explorer.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "root_cause"},
            format="json",
        )

        assert response.status_code == 202, response.data
        assert response.data["run_id"] == 123
        mock_trigger_explorer.assert_called_once()

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_kickoff_returns_sentry_run_id(self, mock_trigger_explorer):
        group = self.create_group()
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=777)
        mock_trigger_explorer.return_value = 777

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id), data={"step": "root_cause"}, format="json"
        )

        assert response.status_code == 202, response.data
        assert response.data == {"run_id": 777, "sentry_run_id": str(run.uuid)}

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_continue_with_sentry_run_id_resolves_to_numeric_id(self, mock_trigger_explorer):
        group = self.create_group()
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=555)
        mock_trigger_explorer.return_value = 555

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "solution", "sentry_run_id": str(run.uuid)},
            format="json",
        )

        assert response.status_code == 202, response.data
        assert response.data == {"run_id": 555, "sentry_run_id": str(run.uuid)}
        assert mock_trigger_explorer.call_args.kwargs["run_id"] == 555

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_continue_with_numeric_run_id_still_works(self, mock_trigger_explorer):
        """The legacy numeric run_id field keeps working unchanged."""
        group = self.create_group()
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=321)
        mock_trigger_explorer.return_value = 321

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "solution", "run_id": 321},
            format="json",
        )

        assert response.status_code == 202, response.data
        assert response.data == {"run_id": 321, "sentry_run_id": str(run.uuid)}
        assert mock_trigger_explorer.call_args.kwargs["run_id"] == 321

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_continue_with_unknown_sentry_run_id_returns_404(self, mock_trigger_explorer):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "solution", "sentry_run_id": str(uuid.uuid4())},
            format="json",
        )

        assert response.status_code == 404, response.data
        mock_trigger_explorer.assert_not_called()

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_continue_with_garbage_sentry_run_id_returns_400(self, mock_trigger_explorer):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "solution", "sentry_run_id": "not-a-real-id"},
            format="json",
        )

        assert response.status_code == 400, response.data
        mock_trigger_explorer.assert_not_called()

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_from_mcp_defaults_referrer_to_mcp(self, mock_trigger_explorer):
        """A request from the Sentry MCP server defaults the referrer to api.mcp."""
        group = self.create_group()
        mock_trigger_explorer.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "root_cause"},
            format="json",
            headers={
                "user-agent": "sentry-mcp/0.35.0 (https://mcp.sentry.dev)",
                "X-Sentry-MCP-Client-Family": "cursor",
            },
        )

        assert response.status_code == 202, response.data
        assert mock_trigger_explorer.call_args.kwargs["referrer"] == AutofixReferrer.MCP

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_explicit_referrer_overrides_mcp_default(self, mock_trigger_explorer):
        """An explicitly supplied referrer takes precedence over the MCP default."""
        group = self.create_group()
        mock_trigger_explorer.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "root_cause", "referrer": AutofixReferrer.WEB.value},
            format="json",
            headers={"user-agent": "sentry-mcp/0.35.0 (https://mcp.sentry.dev)"},
        )

        assert response.status_code == 202, response.data
        assert mock_trigger_explorer.call_args.kwargs["referrer"] == AutofixReferrer.WEB

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_stopping_point(self, mock_trigger_explorer):
        """Stopping point forces the step to be root_cause"""
        group = self.create_group()
        mock_trigger_explorer.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "coding_agent_handoff", "stopping_point": "code_changes"},
            format="json",
        )

        assert response.status_code == 202, response.data
        assert response.data["run_id"] == 123
        mock_trigger_explorer.assert_called_once_with(
            group=group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT,
            stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            run_id=None,
            user_context=None,
            insert_index=None,
        )

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_insert_index_passed_through(self, mock_trigger_explorer):
        """POST passes insert_index to trigger_autofix_agent for retry-from-step."""
        group = self.create_group()
        mock_trigger_explorer.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "solution", "run_id": 42, "insert_index": 3},
            format="json",
        )

        assert response.status_code == 202, response.data
        mock_trigger_explorer.assert_called_once_with(
            group=group,
            step=AutofixStep.SOLUTION,
            referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT,
            stopping_point=None,
            run_id=42,
            user_context=None,
            insert_index=3,
        )

    @patch("sentry.seer.endpoints.group_ai_autofix.publish_action", autospec=True)
    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_kickoff_emits_trigger_autofix_action(self, mock_trigger, mock_publish):
        # A kickoff (no run_id) records the action.
        group = self.create_group()
        mock_trigger.return_value = 123

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "root_cause"},
            format="json",
        )

        assert response.status_code == 202, response.data
        mock_publish.assert_called_once()
        assert isinstance(mock_publish.call_args.args[0], TriggerAutofixAction)
        assert mock_publish.call_args.kwargs["group_id"] == group.id
        assert mock_publish.call_args.kwargs["actor"].actor_id == self.user.id

    @patch("sentry.seer.endpoints.group_ai_autofix.publish_action", autospec=True)
    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_advancing_existing_run_skips_action(self, mock_trigger, mock_publish):
        # Advancing an existing run (run_id provided) is steering, not a new trigger.
        group = self.create_group()
        mock_trigger.return_value = 42

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "solution", "run_id": 42},
            format="json",
        )

        assert response.status_code == 202, response.data
        mock_publish.assert_not_called()

    @patch("sentry.seer.endpoints.group_ai_autofix.publish_action", autospec=True)
    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_coding_agent_handoff")
    def test_coding_agent_handoff_skips_action(self, mock_handoff, mock_publish):
        # The handoff path returns before the built-in-step branch, so it must not log.
        mock_handoff.return_value = {"successes": [], "failures": []}
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "coding_agent_handoff", "run_id": 123, "integration_id": 456},
            format="json",
        )

        assert response.status_code == 202, response.data
        mock_publish.assert_not_called()

    @with_feature("organizations:autofix-pr-iteration")
    @patch("sentry.seer.endpoints.group_ai_autofix.consume_queued_autofix_feedback")
    @patch("sentry.seer.endpoints.group_ai_autofix.try_enqueue_autofix_feedback")
    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_run_state")
    def test_pr_iteration(
        self, mock_run_state, mock_trigger_explorer, mock_try_enqueue, mock_consume
    ):
        group = self.create_group()
        mock_run_state.return_value = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={"owner/repo": RepoPRState(repo_name="owner/repo")},
        )

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "pr_iteration", "run_id": 123, "user_context": "please fix this"},
            format="json",
        )

        assert response.status_code == 202, response.data
        assert response.data["run_id"] == 123
        mock_trigger_explorer.assert_not_called()
        mock_try_enqueue.assert_called_once()
        assert mock_try_enqueue.call_args.kwargs["run_id"] == 123
        assert mock_try_enqueue.call_args.kwargs["group_id"] == group.id
        mock_consume.apply_async.assert_called_once()

    @with_feature({"organizations:autofix-pr-iteration": False})
    @patch("sentry.seer.endpoints.group_ai_autofix.consume_queued_autofix_feedback")
    @patch("sentry.seer.endpoints.group_ai_autofix.try_enqueue_autofix_feedback")
    def test_pr_iteration_requires_feature_flag(self, mock_try_enqueue, mock_consume):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "pr_iteration", "run_id": 123, "user_context": "please fix this"},
            format="json",
        )

        assert response.status_code == 400, response.data
        assert response.data["detail"] == "PR iteration is not enabled for this organization"
        mock_try_enqueue.assert_not_called()

    @with_feature("organizations:autofix-pr-iteration")
    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_pr_iteration_requires_run_id(self, mock_trigger_explorer):
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "pr_iteration"},
            format="json",
        )

        assert response.status_code == 400, response.data
        mock_trigger_explorer.assert_not_called()

    @with_feature("organizations:autofix-pr-iteration")
    @patch("sentry.seer.endpoints.group_ai_autofix.try_enqueue_autofix_feedback")
    @patch("sentry.seer.endpoints.group_ai_autofix.get_autofix_run_state")
    def test_pr_iteration_requires_existing_pr(self, mock_run_state, mock_try_enqueue):
        group = self.create_group()
        mock_run_state.return_value = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={},
        )

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "pr_iteration", "run_id": 123, "user_context": "please fix this"},
            format="json",
        )

        assert response.status_code == 400, response.data
        assert response.data["detail"] == "Cannot iterate on a PR before one has been created"
        mock_try_enqueue.assert_not_called()

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_continue_unknown_run_returns_404(self, mock_trigger_explorer):
        mock_trigger_explorer.side_effect = SeerPermissionError("Unknown run id for group")
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "solution", "run_id": 123},
            format="json",
        )

        assert response.status_code == 404, response.data
        mock_trigger_explorer.assert_called_once()

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent")
    def test_post_returns_402_when_no_seer_quota(self, mock_trigger_explorer):
        """POST returns 402 Payment Required when quota check fails."""
        mock_trigger_explorer.side_effect = NoSeerQuotaException()
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={"step": "root_cause"},
            format="json",
        )

        assert response.status_code == 402, response.data
        assert response.data == "No budget for Seer Autofix."

    def test_post_coding_agent_handoff_errors_with_both_provider_and_integration_id(self) -> None:
        """POST returns 400 when both provider and integration_id are specified for coding_agent_handoff."""
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "coding_agent_handoff",
                "run_id": 123,
                "integration_id": 456,
                "provider": "github_copilot",
            },
            format="json",
        )

        assert response.status_code == 400, response.data
        assert response.data["detail"] == "Cannot specify both integration_id and provider"

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_coding_agent_handoff")
    def test_post_coding_agent_handoff_unknown_run_returns_404(self, mock_handoff):
        mock_handoff.side_effect = SeerPermissionError("Unknown run id for group")
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "coding_agent_handoff",
                "run_id": 123,
                "integration_id": 456,
            },
            format="json",
        )

        assert response.status_code == 404, response.data
        mock_handoff.assert_called_once()
        assert mock_handoff.call_args.kwargs["referrer"] == AutofixReferrer.GROUP_AUTOFIX_ENDPOINT

    @patch("sentry.seer.endpoints.group_ai_autofix.trigger_coding_agent_handoff")
    def test_post_coding_agent_handoff_auto_creates_pr_by_default(self, mock_handoff):
        mock_handoff.return_value = {"successes": [{"repo_name": "owner/repo"}], "failures": []}
        group = self.create_group()

        self.login_as(user=self.user)
        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "coding_agent_handoff",
                "run_id": 123,
                "integration_id": 456,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        mock_handoff.assert_called_once_with(
            group=group,
            run_id=123,
            referrer=AutofixReferrer.GROUP_AUTOFIX_ENDPOINT,
            integration_id=456,
            provider=None,
            user_id=self.user.id,
            auto_create_pr=True,
        )

    @patch("sentry.seer.agent.client_utils.make_agent_state_request")
    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_open_pr(self, mock_explorer_update_request, mock_explorer_state_request):
        self.login_as(user=self.user)
        group = self.create_group()

        mock_explorer_update_response = Mock()
        mock_explorer_update_response.status = 200
        mock_explorer_update_request.return_value = mock_explorer_update_response

        mock_explorer_state_response = Mock()
        mock_explorer_state_response.status = 200
        mock_explorer_state_response.json = Mock(
            return_value={
                "session": {
                    **SeerRunState(
                        run_id=123,
                        blocks=[],
                        status="completed",
                        updated_at="2023-07-18T12:00:00Z",
                    ).dict(),
                    "metadata": {"group_id": group.id},
                }
            }
        )
        mock_explorer_state_request.return_value = mock_explorer_state_response

        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "open_pr",
                "run_id": 123,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        assert response.data == {"run_id": 123, "sentry_run_id": None}

    @patch("sentry.seer.agent.client_utils.make_agent_state_request")
    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_open_pr_with_repo_name(
        self, mock_explorer_update_request, mock_explorer_state_request
    ):
        self.login_as(user=self.user)
        group = self.create_group()

        mock_explorer_update_response = Mock()
        mock_explorer_update_response.status = 200
        mock_explorer_update_request.return_value = mock_explorer_update_response

        mock_explorer_state_response = Mock()
        mock_explorer_state_response.status = 200
        mock_explorer_state_response.json = Mock(
            return_value={
                "session": {
                    **SeerRunState(
                        run_id=123,
                        blocks=[],
                        status="completed",
                        updated_at="2023-07-18T12:00:00Z",
                    ).dict(),
                    "metadata": {"group_id": group.id},
                }
            }
        )
        mock_explorer_state_request.return_value = mock_explorer_state_response

        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "open_pr",
                "run_id": 123,
                "repo_name": "my-org/my-repo",
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        call_body = mock_explorer_update_request.call_args[0][0]
        assert call_body["payload"]["type"] == "create_pr"
        assert call_body["payload"]["repo_name"] == "my-org/my-repo"

    @patch("sentry.seer.agent.client_utils.make_agent_state_request")
    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_open_pr_without_repo_name(
        self, mock_explorer_update_request, mock_explorer_state_request
    ):
        self.login_as(user=self.user)
        group = self.create_group()

        mock_explorer_update_response = Mock()
        mock_explorer_update_response.status = 200
        mock_explorer_update_request.return_value = mock_explorer_update_response

        mock_explorer_state_response = Mock()
        mock_explorer_state_response.status = 200
        mock_explorer_state_response.json = Mock(
            return_value={
                "session": {
                    **SeerRunState(
                        run_id=123,
                        blocks=[],
                        status="completed",
                        updated_at="2023-07-18T12:00:00Z",
                    ).dict(),
                    "metadata": {"group_id": group.id},
                }
            }
        )
        mock_explorer_state_request.return_value = mock_explorer_state_response

        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "open_pr",
                "run_id": 123,
            },
            format="json",
        )

        assert response.status_code == 202, response.data
        call_body = mock_explorer_update_request.call_args[0][0]
        assert call_body["payload"]["type"] == "create_pr"
        assert "repo_name" not in call_body["payload"]

    def test_open_pr_no_run_id(self) -> None:
        self.login_as(user=self.user)
        group = self.create_group()

        response = self.client.post(
            self._get_url(group.id),
            data={"step": "open_pr"},
            format="json",
        )

        assert response.status_code == 400, response.data
        assert response.data["detail"] == "run_id is required for open_pr"

    @patch("sentry.seer.agent.client_utils.make_agent_state_request")
    def test_open_pr_permission_error(self, mock_explorer_state_request):
        self.login_as(user=self.user)
        group = self.create_group()

        mock_explorer_state_response = Mock()
        mock_explorer_state_response.status = 200
        mock_explorer_state_response.json = Mock(
            return_value={
                "session": SeerRunState(
                    run_id=123,
                    blocks=[],
                    status="completed",
                    updated_at="2023-07-18T12:00:00Z",
                ).dict()
            }
        )
        mock_explorer_state_request.return_value = mock_explorer_state_response

        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "open_pr",
                "run_id": 123,
            },
            format="json",
        )

        assert response.status_code == 404, response.data

    def test_open_pr_coding_disabled(self):
        self.login_as(user=self.user)
        group = self.create_group()
        self.organization.update_option("sentry:enable_seer_coding", False)

        response = self.client.post(
            self._get_url(group.id),
            data={
                "step": "open_pr",
                "run_id": 123,
            },
            format="json",
        )

        assert response.status_code == 403, response.data
