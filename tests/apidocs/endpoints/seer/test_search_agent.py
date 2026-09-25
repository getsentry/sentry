from unittest.mock import Mock, patch

from django.test import override_settings
from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.apidocs.examples.search_agent_examples import SearchAgentExamples
from sentry.seer.models.run import SeerRunType
from sentry.testutils.helpers.features import with_feature

TRANSLATE_RESPONSE = SearchAgentExamples.TRANSLATE_RESPONSE[0].value
COMPLETED_STATE = SearchAgentExamples.STATE_RESPONSE[1].value


@override_settings(SEER_AUTOFIX_URL="https://seer.example.com")
@with_feature("organizations:gen-ai-features")
@patch(
    "sentry.seer.endpoints.search_agent_start.has_seer_access_with_detail",
    return_value=(True, None),
)
class SearchAgentStartDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.url = reverse(
            "sentry-api-0-search-agent-start",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.login_as(user=self.user)

    @with_feature("organizations:gen-ai-search-agent-translate")
    @patch("sentry.seer.endpoints.search_agent_start.send_search_agent_start_request")
    def test_post(self, mock_send_request: Mock, _mock_access: Mock) -> None:
        mock_send_request.return_value = self.create_seer_run(
            type=SeerRunType.ASSISTED_QUERY, seer_run_state_id=12345
        )
        data = {"project_ids": [self.project.id], "natural_language_query": "slow requests"}
        response = self.client.post(self.url, data, format="json")
        request = RequestFactory().post(self.url, data, content_type="application/json")

        self.validate_schema(request, response)


@override_settings(SEER_AUTOFIX_URL="https://seer.example.com")
@with_feature("organizations:gen-ai-features")
@patch(
    "sentry.seer.endpoints.search_agent_state.has_seer_access_with_detail",
    return_value=(True, None),
)
class SearchAgentStateDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.seer_run = self.create_seer_run(
            type=SeerRunType.ASSISTED_QUERY, seer_run_state_id=12345
        )
        self.url = reverse(
            "sentry-api-0-search-agent-state",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "run_id": str(self.seer_run.uuid),
            },
        )
        self.login_as(user=self.user)

    @with_feature("organizations:gen-ai-search-agent-translate")
    @patch("sentry.seer.endpoints.search_agent_state.make_search_agent_state_request")
    def test_get(self, mock_request: Mock, _mock_access: Mock) -> None:
        mock_request.return_value = Mock(
            status=200, json=Mock(return_value={"session": COMPLETED_STATE["session"]})
        )
        response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)


@override_settings(SEER_AUTOFIX_URL="https://seer.example.com")
@with_feature("organizations:gen-ai-features")
@patch(
    "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.has_seer_access_with_detail",
    return_value=(True, None),
)
class SearchAgentTranslateDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.url = reverse(
            "sentry-api-0-search-agent-translate",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        self.login_as(user=self.user)

    @with_feature("organizations:seer-explorer")
    @patch(
        "sentry.seer.endpoints.trace_explorer_ai_translate_agentic.make_translate_agentic_request"
    )
    def test_post(self, mock_request: Mock, _mock_access: Mock) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value=TRANSLATE_RESPONSE))
        data = {"project_ids": [self.project.id], "natural_language_query": "slow requests"}
        response = self.client.post(self.url, data, format="json")
        request = RequestFactory().post(self.url, data, content_type="application/json")

        self.validate_schema(request, response)
