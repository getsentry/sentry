from unittest.mock import Mock

from requests.models import Response

from sentry.sentry_apps.services.app_request import SentryAppRequestFilterArgs, app_request_service
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test, create_test_regions
from sentry.utils import json
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


@django_db_all(transaction=True)
@control_silo_test(regions=create_test_regions("us"))
class TestRegionApp(TestCase):
    def setUp(self):
        self.user = Factories.create_user()
        self.org = Factories.create_organization(owner=self.user, region="us")
        self.app = Factories.create_sentry_app(
            name="demo-app",
            user=self.user,
            organization=self.org,
            published=True,
            schema={
                "elements": [
                    {
                        "type": "alert-rule-trigger",
                        "title": "go beep",
                        "settings": {
                            "type": "alert-rule-settings",
                            "uri": "https://example.com/search/",
                        },
                    },
                ]
            },
        )

    def test_get_buffer_requests_for_region(self):
        buffer = SentryAppWebhookRequestsBuffer(self.app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.app.webhook_url,
        )
        requests = app_request_service.get_buffer_requests_for_region(
            sentry_app_id=self.app.id, region_name="us"
        )
        assert requests and len(requests) == 1
        assert requests[0].organization_id == self.org.id

    def test_get_buffer_requests_for_region_with_error_request(self):
        buffer = SentryAppWebhookRequestsBuffer(self.app)

        mock_response = Mock(spec=Response)
        mock_response.content = '{"content": "mock response content"}'
        mock_request = Mock()
        mock_request.body = "mock request body"
        mock_response.request = mock_request

        buffer.add_request(
            response_code=404,
            org_id=self.org.id,
            event="issue.assigned",
            url="https://example.com/hook",
            error_id="abc123",
            project_id=1,
            response=mock_response,
            headers={
                "Content-Type": "application/json",
            },
        )
        requests = app_request_service.get_buffer_requests_for_region(
            sentry_app_id=self.app.id, region_name="us"
        )
        assert requests and len(requests) == 1
        assert requests[0].error_id == "abc123"
        assert requests[0].project_id == 1
        assert requests[0].request_body == json.dumps(mock_request.body)
        assert requests[0].request_headers == {
            "Content-Type": "application/json",
        }
        assert requests[0].response_body == json.dumps(mock_response.content)

    def test_get_filtered_buffer_requests_for_region(self):
        buffer = SentryAppWebhookRequestsBuffer(self.app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url=self.app.webhook_url,
        )
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.resolved",
            url=self.app.webhook_url,
        )
        filter: SentryAppRequestFilterArgs = {"event": "issue.assigned"}
        requests = app_request_service.get_buffer_requests_for_region(
            sentry_app_id=self.app.id, region_name="us", filter=filter
        )
        assert requests and len(requests) == 1
        assert requests[0].organization_id == self.org.id

    def test_empty_buffer(self):
        requests = app_request_service.get_buffer_requests_for_region(
            sentry_app_id=self.app.id, region_name="us"
        )
        assert requests == []

    def test_invalid_app_id(self):
        requests = app_request_service.get_buffer_requests_for_region(
            sentry_app_id=-1,
            region_name="us",
        )
        assert requests is None
