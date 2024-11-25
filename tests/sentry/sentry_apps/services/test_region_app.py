from sentry.sentry_apps.services.region_app import SentryAppRequestFilterArgs, region_app_service
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test, create_test_regions
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
        requests = region_app_service.get_buffer_requests_for_region(
            sentry_app=self.app, region_name="us"
        )
        assert len(requests) == 1
        assert requests[0].organization_id == self.org.id

    def test_get_buffer_requests_for_region_with_error_request(self):
        buffer = SentryAppWebhookRequestsBuffer(self.app)
        buffer.add_request(
            response_code=200,
            org_id=self.org.id,
            event="issue.assigned",
            url="https://example.com/hook",
            error_id="d5111da2c28645c5889d072017e3445d",
            project_id=1,
        )
        requests = region_app_service.get_buffer_requests_for_region(
            sentry_app=self.app, region_name="us"
        )
        assert len(requests) == 1
        assert requests[0].error_id == "d5111da2c28645c5889d072017e3445d"
        assert requests[0].project_id == 1

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
        requests = region_app_service.get_buffer_requests_for_region(
            sentry_app=self.app, region_name="us", filter=filter
        )
        assert len(requests) == 1
        assert requests[0].organization_id == self.org.id
