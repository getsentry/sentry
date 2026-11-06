from typing import Any
from unittest.mock import MagicMock, patch

from rest_framework.response import Response

from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import NoSeerQuotaException
from sentry.seer.autofix.steps import AutofixStep
from sentry.testutils.cases import APITestCase
from sentry.viewer_context import ActorType, get_viewer_context


@patch("sentry.seer.endpoints.admin_autofix_single_run.trigger_autofix_agent")
class SeerAdminAutofixSingleRunTest(APITestCase):
    endpoint = "sentry-admin-seer-autofix-single-run"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user(is_staff=True)
        self.login_as(user=self.user)
        self.organization = self.create_organization(slug="sentry")
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def get_response(self, *args: Any, **params: Any) -> Response:
        with patch("sentry.api.permissions.is_active_staff", return_value=True):
            return super().get_response(*args, **params)

    def test_starts_single_run_and_returns_link(self, mock_trigger: MagicMock) -> None:
        mock_trigger.return_value = self.create_seer_run(
            organization=self.organization, seer_run_state_id=321
        )

        response = self.get_success_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id
        )

        kwargs = mock_trigger.call_args.kwargs
        assert kwargs["group"] == self.group
        assert kwargs["step"] == AutofixStep.ROOT_CAUSE
        assert kwargs["referrer"] == AutofixReferrer.ADMIN
        assert kwargs["single_run"] is True
        assert kwargs["user"].id == self.user.id
        assert response.data["url"] == self.organization.absolute_url(
            f"/organizations/sentry/issues/{self.group.id}/",
            query=f"project={self.project.id}&explorerRunId=321",
        )

    def test_automated_start_has_no_owner(self, mock_trigger: MagicMock) -> None:
        run = self.create_seer_run(organization=self.organization, seer_run_state_id=321)
        actor_types = []

        def trigger(**kwargs: Any) -> Any:
            ctx = get_viewer_context()
            actor_types.append(ctx.actor.type if ctx else None)
            return run

        mock_trigger.side_effect = trigger

        self.get_success_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, automated=True
        )

        kwargs = mock_trigger.call_args.kwargs
        assert kwargs["referrer"] == AutofixReferrer.ADMIN_AUTOMATED
        assert kwargs["user"] is None
        assert kwargs["actor_user_id"] is None
        assert actor_types == [ActorType.SYSTEM]

    def test_coding_agent_project_is_rejected(self, mock_trigger: MagicMock) -> None:
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 456)

        self.get_error_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, status_code=400
        )

        mock_trigger.assert_not_called()

    def test_out_of_quota_returns_reason(self, mock_trigger: MagicMock) -> None:
        mock_trigger.side_effect = NoSeerQuotaException()

        response = self.get_error_response(
            organization_slug="sentry", short_id=self.group.qualified_short_id, status_code=400
        )

        assert response.data["detail"]

    def test_unknown_issue_returns_404(self, mock_trigger: MagicMock) -> None:
        self.get_error_response(organization_slug="sentry", short_id="NOPE-1", status_code=404)

        mock_trigger.assert_not_called()

    def test_requires_staff(self, mock_trigger: MagicMock) -> None:
        self.login_as(user=self.create_user())

        with patch("sentry.api.permissions.is_active_staff", return_value=False):
            response = self.client.post(
                "/api/0/internal/seer/autofix/single-run/",
                {"organization_slug": "sentry", "short_id": self.group.qualified_short_id},
            )

        assert response.status_code == 403
        mock_trigger.assert_not_called()
