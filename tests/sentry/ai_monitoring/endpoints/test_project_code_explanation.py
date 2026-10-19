from unittest.mock import MagicMock, patch

import orjson
import pytest
from django.test import override_settings
from urllib3.exceptions import TimeoutError

from sentry.ai_monitoring.code_explanations import MAX_CODE_LENGTH
from sentry.ai_monitoring.endpoints.project_code_explanation import CodeExplanationRequestSerializer
from sentry.testutils.cases import APITestCase

CODE = "async () => await codemode.add({a: 12, b: 8})"
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
                "sentry.seer.oneshot.make_oneshot_request",
                return_value=MagicMock(
                    status=200, data=orjson.dumps({"result": {"summary": "Add two numbers"}})
                ),
            )
        )

    def test_generates_summary_with_a_single_oneshot_request(self) -> None:
        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)

        assert response.data == {"summary": "Add two numbers"}
        self.mock_seer.assert_called_once()
        body = self.mock_seer.call_args.args[0]
        assert body == {"oneshot_id": "code_explanation", "payload": PAYLOAD}
        assert self.mock_seer.call_args.kwargs == {
            "timeout": 10,
            "viewer_context": {
                "organization_id": self.organization.id,
                "user_id": self.user.id,
            },
        }

    def test_reuses_cached_summary(self) -> None:
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)

        assert response.data == {"summary": "Add two numbers"}
        self.mock_seer.assert_called_once()

    def test_cache_is_scoped_to_project(self) -> None:
        other_project = self.create_project(organization=self.organization)
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        self.get_success_response(self.organization.slug, other_project.slug, **PAYLOAD)

        assert self.mock_seer.call_count == 2

    def test_cache_key_includes_code_and_language(self) -> None:
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        self.get_success_response(
            self.organization.slug, self.project.slug, code="return 1", language="javascript"
        )
        self.get_success_response(
            self.organization.slug, self.project.slug, code="return 1", language="python"
        )

        assert self.mock_seer.call_count == 3

    def test_rechecks_ai_settings_before_serving_cached_summary(self) -> None:
        self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        self.organization.update_option("sentry:hide_ai_features", True)

        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=403, **PAYLOAD
        )
        self.mock_seer.assert_called_once()

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_unavailable_on_self_hosted(self) -> None:
        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=403, **PAYLOAD
        )
        self.mock_seer.assert_not_called()

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

    def test_missing_code_does_not_call_seer(self) -> None:
        response = self.get_error_response(
            self.organization.slug, self.project.slug, language="javascript", status_code=400
        )
        assert "detail" in response.data
        self.mock_seer.assert_not_called()

    def test_timeout_is_not_cached(self) -> None:
        self.mock_seer.side_effect = TimeoutError()
        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=502, **PAYLOAD
        )
        self.mock_seer.side_effect = None
        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        assert response.data == {"summary": "Add two numbers"}
        assert self.mock_seer.call_count == 2

    def test_invalid_summary_is_not_cached(self) -> None:
        for result in ({}, {"summary": 123}, {"summary": ""}):
            self.mock_seer.return_value.data = orjson.dumps({"result": result})
            self.get_error_response(
                self.organization.slug, self.project.slug, status_code=502, **PAYLOAD
            )
        self.mock_seer.return_value.data = orjson.dumps({"result": {"summary": "Add two numbers"}})
        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        assert response.data == {"summary": "Add two numbers"}
        assert self.mock_seer.call_count == 4

    def test_normalizes_summary_whitespace(self) -> None:
        self.mock_seer.return_value.data = orjson.dumps(
            {"result": {"summary": "  Add\n two   numbers  "}}
        )
        response = self.get_success_response(self.organization.slug, self.project.slug, **PAYLOAD)
        assert response.data == {"summary": "Add two numbers"}

    def test_rejects_long_summary(self) -> None:
        self.mock_seer.return_value.data = orjson.dumps({"result": {"summary": "x" * 257}})
        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=502, **PAYLOAD
        )

    def test_rejects_verbose_summary(self) -> None:
        self.mock_seer.return_value.data = orjson.dumps({"result": {"summary": "word " * 13}})
        self.get_error_response(
            self.organization.slug, self.project.slug, status_code=502, **PAYLOAD
        )


class TestCodeExplanationRequestSerializer:
    @pytest.mark.parametrize("code", [" \n ", "x" * (MAX_CODE_LENGTH + 1)])
    def test_rejects_invalid_code(self, code: str) -> None:
        serializer = CodeExplanationRequestSerializer(data={"code": code})
        assert not serializer.is_valid()
        assert "code" in serializer.errors

    @pytest.mark.parametrize(
        "code", ["  async () => {\n    return 1;\n  }\n", "x" * MAX_CODE_LENGTH]
    )
    def test_preserves_code_and_defaults_language(self, code: str) -> None:
        serializer = CodeExplanationRequestSerializer(data={"code": code})
        assert serializer.is_valid(), serializer.errors
        assert serializer.validated_data == {"code": code, "language": "javascript"}
