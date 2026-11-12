from unittest.mock import MagicMock, patch

from django.test import override_settings
from urllib3.exceptions import TimeoutError

from sentry.testutils.cases import APITestCase

CODE = "  async () => {\n    return await codemode.add({a: 12, b: 8});\n  }\n"
PAYLOAD = {"code": CODE, "language": "javascript"}


@override_settings(SENTRY_SELF_HOSTED=False)
class ProjectCodeExplanationEndpointTest(APITestCase):
    endpoint = "sentry-api-0-project-code-explanation"
    method = "post"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.mock_seer: MagicMock = self.enterContext(
            patch(
                "sentry.ai_monitoring.code_explanations.run_oneshot",
                return_value={"summary": "Add two numbers"},
            )
        )

    def test_returns_and_caches_summary(self) -> None:
        self.mock_seer.return_value = {"summary": "  Add\n two   numbers  "}

        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        cached = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)

        assert response.data == cached.data == {"summary": "Add two numbers"}
        self.mock_seer.assert_called_once_with(
            "code_explanation", PAYLOAD, self.organization, timeout=10
        )

    def test_cache_is_scoped_to_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        self.mock_seer.return_value = {"summary": "Another project summary"}

        response = self.get_success_response(self.organization.slug, other_project.slug, **PAYLOAD)

        assert response.data == {"summary": "Another project summary"}

    def test_cache_key_includes_code_and_language(self) -> None:
        self.mock_seer.side_effect = [
            {"summary": "Add two numbers"},
            {"summary": "Return a number"},
            {"summary": "Return a Python number"},
        ]
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        changed_code = self.get_success_response(
            self.organization.slug, self.project.slug, code="return 1", language="javascript"
        )
        changed_language = self.get_success_response(
            self.organization.slug, self.project.slug, code="return 1", language="python"
        )

        assert changed_code.data == {"summary": "Return a number"}
        assert changed_language.data == {"summary": "Return a Python number"}

    def test_rechecks_ai_settings_before_serving_cached_summary(self) -> None:
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        self.organization.update_option("sentry:hide_ai_features", True)

        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=403, **PAYLOAD
        )
        self.mock_seer.assert_called_once()

    def test_requires_project_access_even_for_cached_summary(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)

        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=403, **PAYLOAD
        )
        self.mock_seer.assert_called_once()

    def test_accepts_project_read_token(self) -> None:
        token = self.create_user_auth_token(self.user, scope_list=["project:read"])
        self.client.cookies.clear()

        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
            extra_headers={"HTTP_AUTHORIZATION": f"Bearer {token.token}"},
            **PAYLOAD,
        )
        assert response.data == {"summary": "Add two numbers"}

    def test_invalid_input_does_not_call_seer(self) -> None:
        for payload in ({}, {"code": " \n "}, {"code": "x" * 4_001}):
            self.get_error_response(
                self.organization.slug, self.project.slug, status_code=400, **payload
            )
        self.mock_seer.assert_not_called()

    def test_timeout_does_not_prevent_retry(self) -> None:
        self.mock_seer.side_effect = TimeoutError()
        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=502, **PAYLOAD
        )
        self.mock_seer.side_effect = None

        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)

        assert response.data == {"summary": "Add two numbers"}

    def test_invalid_summary_does_not_prevent_retry(self) -> None:
        for summary in (None, 123, "", "x" * 257, "word " * 13):
            self.mock_seer.return_value = {"summary": summary}
            self.get_error_response(
                self.organization.slug, self.project.slug, status_code=502, **PAYLOAD
            )
        self.mock_seer.return_value = {"summary": "Add two numbers"}

        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)

        assert response.data == {"summary": "Add two numbers"}
