from typing import Any
from unittest.mock import MagicMock, Mock, patch

import pytest
from django.test import override_settings
from rest_framework import status

from sentry.models.apitoken import ApiToken
from sentry.seer.endpoints.search_agent_start import (
    SearchAgentReferrer,
    SearchAgentResultTarget,
    send_search_agent_start_request,
)
from sentry.seer.models import SeerApiError
from sentry.seer.models.run import SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode


class SendSearchAgentStartRequestTest(TestCase):
    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_outbox_path_creates_run_and_flushes(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 42}))
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        result = send_search_agent_start_request(
            organization=self.organization,
            user_id=self.user.id,
            project_ids=[self.project.id],
            natural_language_query="errors today",
            strategy="Issues",
            viewer_context=viewer_context,
        )

        assert isinstance(result, SeerRun)
        assert result.type == SeerRunType.ASSISTED_QUERY
        assert result.mirror_status == SeerRunMirrorStatus.LIVE
        assert result.seer_run_state_id == 42
        assert result.user_id == self.user.id
        mock_request.assert_called_once()
        sent_body = mock_request.call_args[0][0]
        assert sent_body["natural_language_query"] == "errors today"

    def test_outbox_flush_error_raises(self) -> None:
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        with pytest.raises(SeerApiError):
            send_search_agent_start_request(
                organization=self.organization,
                user_id=self.user.id,
                project_ids=[self.project.id],
                natural_language_query="errors today",
                viewer_context=viewer_context,
            )

    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_terminal_seer_failure_raises(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=400, json=Mock(return_value={}))
        viewer_context = SeerViewerContext(
            organization_id=self.organization.id, user_id=self.user.id
        )

        with pytest.raises(SeerApiError):
            send_search_agent_start_request(
                organization=self.organization,
                user_id=self.user.id,
                project_ids=[self.project.id],
                natural_language_query="errors today",
                viewer_context=viewer_context,
            )

    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_flag_options_default_to_false(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 42}))

        send_search_agent_start_request(
            organization=self.organization,
            user_id=self.user.id,
            project_ids=[self.project.id],
            natural_language_query="errors today",
        )

        sent_options = mock_request.call_args[0][0]["options"]
        for flag in ["cross_event", "reflection_step", "code_mode"]:
            assert sent_options[flag] is False
        assert "result_target" not in sent_options
        assert "source" not in sent_options

    @patch("sentry.receivers.outbox.cell.make_search_agent_start_request")
    def test_flag_options_are_sent_to_seer(self, mock_request: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 42}))

        send_search_agent_start_request(
            organization=self.organization,
            user_id=self.user.id,
            project_ids=[self.project.id],
            natural_language_query="errors today",
            model_name="gpt-5",
            cross_event=True,
            reflection_step=True,
            code_mode=True,
            result_target=SearchAgentResultTarget.AGENT_SEARCH,
            referrer=SearchAgentReferrer.MCP,
        )

        sent_options = mock_request.call_args[0][0]["options"]
        for flag in ["cross_event", "reflection_step", "code_mode"]:
            assert sent_options[flag] is True
        assert sent_options["model_name"] == "gpt-5"
        assert sent_options["result_target"] == "agent_search"
        assert sent_options["source"] == "mcp"


@override_settings(SENTRY_SELF_HOSTED=False)
class SearchAgentStartEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.url = f"/api/0/organizations/{self.organization.slug}/search-agent/start/"

        self.seer_access_patcher = patch(
            "sentry.seer.endpoints.search_agent_start.has_seer_access_with_detail",
            return_value=(True, None),
        )
        self.seer_access_patcher.start()

    def tearDown(self) -> None:
        self.seer_access_patcher.stop()
        super().tearDown()

    def _post(self, **extra_data: Any) -> Any:
        return self.client.post(
            self.url,
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "show errors",
                **extra_data,
            },
            format="json",
        )

    def _post_with_token(self, **extra_data: Any) -> Any:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = ApiToken.objects.create(user=self.user, scope_list=["org:read"])
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token.token}")
        return self._post(**extra_data)

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    @with_feature("organizations:seer-assisted-query-cross-event-explorer")
    @with_feature("organizations:seer-assisted-query-reflection")
    @with_feature("organizations:seer-assisted-query-codemode")
    def test_start_forwards_feature_flags(self, mock_send_request: MagicMock) -> None:
        """Feature flags are forwarded to Seer as request options. Code mode tested separately."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        assert response.data == {"run_id": 42, "sentry_run_id": "run-uuid"}
        kwargs = mock_send_request.call_args.kwargs
        assert kwargs["cross_event"] is True
        assert kwargs["reflection_step"] is True

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_issues_strategy_still_gated(self, mock_send_request: MagicMock) -> None:
        """Issues has not GA'd yet, so its per-strategy flag still gates the endpoint."""
        with self.feature({"organizations:gen-ai-issues-search": False}):
            response = self._post(strategy="Issues")

        assert response.status_code == status.HTTP_403_FORBIDDEN
        mock_send_request.assert_not_called()

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_start_without_feature_flags(self, mock_send_request: MagicMock) -> None:
        """Options are False when the org has none of the flags."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        kwargs = mock_send_request.call_args.kwargs
        assert kwargs["cross_event"] is False
        assert kwargs["reflection_step"] is False

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    @with_feature("organizations:seer-assisted-query-codemode")
    def test_code_mode_enabled_by_flag(self, mock_send_request: MagicMock) -> None:
        """Code mode follows the flag without callers opting in."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["code_mode"] is True

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_code_mode_option_ignored_without_flag(self, mock_send_request: MagicMock) -> None:
        """A client-sent code_mode option can't enable code mode without the flag."""
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post(options={"code_mode": True, "model_name": "gpt-5"})

        assert response.status_code == status.HTTP_200_OK
        kwargs = mock_send_request.call_args.kwargs
        assert kwargs["code_mode"] is False
        assert kwargs["model_name"] == "gpt-5"

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_session_request_infers_ui_search(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        assert (
            mock_send_request.call_args.kwargs["result_target"] == SearchAgentResultTarget.UI_SEARCH
        )

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_token_request_infers_agent_search(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post_with_token()

        assert response.status_code == status.HTTP_200_OK
        assert (
            mock_send_request.call_args.kwargs["result_target"]
            == SearchAgentResultTarget.AGENT_SEARCH
        )

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_allowlisted_referrer_is_forwarded(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post(referrer="search_bar")

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["referrer"] == SearchAgentReferrer.SEARCH_BAR

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_unrecognized_referrer_falls_back_to_unknown(
        self, mock_send_request: MagicMock
    ) -> None:
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post_with_token(referrer="not-a-real-referrer")

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["referrer"] == SearchAgentReferrer.UNKNOWN

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_missing_referrer_from_ui_is_frontend(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post()

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["referrer"] == SearchAgentReferrer.FRONTEND

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_missing_referrer_from_api_token_is_unknown(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")

        response = self._post_with_token()

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["referrer"] == SearchAgentReferrer.UNKNOWN

    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    @patch("django.conf.settings.SEER_AUTOFIX_URL", "https://seer.example.com")
    def test_mcp_user_agent_overrides_declared_referrer(self, mock_send_request: MagicMock) -> None:
        mock_send_request.return_value = Mock(seer_run_state_id=42, uuid="run-uuid")
        self.client.defaults["HTTP_USER_AGENT"] = "sentry-mcp/1.2.3 (https://mcp.sentry.dev)"

        response = self._post_with_token(referrer="search_bar")

        assert response.status_code == status.HTTP_200_OK
        assert mock_send_request.call_args.kwargs["referrer"] == SearchAgentReferrer.MCP


@with_feature("organizations:seer-explorer")
@override_settings(SENTRY_SELF_HOSTED=False, SEER_AUTOFIX_URL="https://seer.example.com")
class SearchAgentTransformationCapabilitiesTest(APITestCase):
    route = "start"
    seer_request = "sentry.receivers.outbox.cell.make_search_agent_start_request"
    access_check = "sentry.seer.endpoints.search_agent_start.has_seer_access_with_detail"
    default_code_mode = True
    forwards_unknown_options = False

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)
        access_patch = patch(self.access_check, return_value=(True, None))
        self.addCleanup(access_patch.stop)
        access_patch.start()
        transport_patch = patch(self.seer_request)
        self.addCleanup(transport_patch.stop)
        self.transport = transport_patch.start()
        self.transport.return_value = Mock(
            status=200,
            json=Mock(side_effect=[{"run_id": run_id, "status": "ok"} for run_id in range(42, 52)]),
        )

    def _post(self, **extra_data: Any) -> Any:
        return self.client.post(
            f"/api/0/organizations/{self.organization.slug}/search-agent/{self.route}/",
            data={
                "project_ids": [self.project.id],
                "natural_language_query": "show a smoothed timeseries",
                **extra_data,
            },
            format="json",
        )

    def test_capabilities_reach_seer(self) -> None:
        for interpolation, spans, logs, metrics, expected in [
            (True, True, True, True, ["spans", "logs", "tracemetrics"]),
            (False, True, True, True, []),
            (True, True, False, False, ["spans"]),
            (True, False, True, False, ["logs"]),
            (True, False, False, True, ["tracemetrics"]),
            (True, False, False, False, []),
        ]:
            with (
                self.subTest(expected=expected, interpolation=interpolation),
                self.feature(
                    {
                        "organizations:seer-assisted-query-codemode": True,
                        "organizations:explore-interpolation-and-smoothing": interpolation,
                        "organizations:visibility-explore-view": spans,
                        "organizations:ourlogs-enabled": logs,
                        "organizations:tracemetrics-enabled": metrics,
                    }
                ),
            ):
                response = self._post(options={"code_mode": True})

                assert response.status_code == status.HTTP_200_OK
                body = self.transport.call_args[0][0]
                assert body["options"]["transformation_capabilities"] == {"datasets": expected}
                assert body["project_ids"] == [self.project.id]
                assert body["org_id"] == self.organization.id

    def test_code_mode_disabled_omits_capabilities(self) -> None:
        with self.feature(
            {
                "organizations:seer-assisted-query-codemode": False,
                "organizations:explore-interpolation-and-smoothing": True,
            }
        ):
            response = self._post(options={"code_mode": True})

        assert response.status_code == status.HTTP_200_OK
        options_sent = self.transport.call_args[0][0]["options"]
        assert options_sent["code_mode"] is False
        assert "transformation_capabilities" not in options_sent

    def test_client_cannot_claim_capabilities(self) -> None:
        for capabilities in [None, {"datasets": ["spans"]}]:
            with self.subTest(capabilities=capabilities):
                response = self._post(options={"transformation_capabilities": capabilities})

                assert response.status_code == status.HTTP_400_BAD_REQUEST
                assert str(response.data["options"][0]) == (
                    "transformation_capabilities is derived by Sentry"
                )
                self.transport.assert_not_called()

    def test_omitted_options_preserve_route_default(self) -> None:
        option_variants: list[dict[str, Any]] = [{}, {"options": None}]
        for extra_data in option_variants:
            with (
                self.subTest(extra_data=extra_data),
                self.feature(
                    {
                        "organizations:seer-assisted-query-codemode": True,
                        "organizations:explore-interpolation-and-smoothing": False,
                    }
                ),
            ):
                response = self._post(**extra_data)

                assert response.status_code == status.HTTP_200_OK
                options = self.transport.call_args[0][0]["options"]
                assert options["code_mode"] is self.default_code_mode
                assert (
                    options.get("transformation_capabilities")
                    == ({"start": {"datasets": []}, "translate": None}[self.route])
                )

    def test_capabilities_preserve_query_options(self) -> None:
        metric_context = {"metric_name": "http.request.duration", "metric_type": "distribution"}
        with self.feature(
            {
                "organizations:seer-assisted-query-codemode": True,
                "organizations:explore-interpolation-and-smoothing": True,
                "organizations:tracemetrics-enabled": True,
            }
        ):
            response = self._post(
                strategy="Metrics",
                options={
                    "code_mode": True,
                    "model_name": "gpt-5",
                    "metric_context": metric_context,
                    "unrecognized_option": "preserved by synchronous translation",
                },
            )

        assert response.status_code == status.HTTP_200_OK
        body = self.transport.call_args[0][0]
        options = body["options"]
        assert body["strategy"] == "Metrics"
        assert options["model_name"] == "gpt-5"
        assert options["metric_context"] == metric_context
        assert "tracemetrics" in options["transformation_capabilities"]["datasets"]
        assert ("unrecognized_option" in options) is self.forwards_unknown_options

    def test_invalid_model_name_rejected(self) -> None:
        response = self._post(options={"model_name": 123})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert str(response.data["options"][0]) == "model_name must be a string"
        self.transport.assert_not_called()

    def test_foreign_project_rejected(self) -> None:
        other_project = self.create_project(organization=self.create_organization())

        response = self._post(project_ids=[other_project.id])

        assert response.status_code == status.HTTP_403_FORBIDDEN
        self.transport.assert_not_called()

    def test_inaccessible_project_rejected(self) -> None:
        project = self.project
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        member = self.create_user()
        self.create_member(organization=self.organization, user=member, role="member")
        self.login_as(member)

        response = self._post(project_ids=[project.id])

        assert response.status_code == status.HTTP_403_FORBIDDEN
        self.transport.assert_not_called()


class SearchAgentTranslateTransformationCapabilitiesTest(SearchAgentTransformationCapabilitiesTest):
    route = "translate"
    seer_request = (
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.make_translate_agentic_request"
    )
    access_check = (
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.has_seer_access_with_detail"
    )
    default_code_mode = False
    forwards_unknown_options = True
