from sentry.sentry_apps.services.region_app import SentryAppRequestFilterArgs, region_app_service
from sentry.testutils.cases import TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test, create_test_regions
from sentry.utils.sentry_apps import SentryAppWebhookRequestsBuffer


@django_db_all(transaction=True)
@control_silo_test(regions=create_test_regions("us"))
class TestRegionApp(TestCase):
    def test_get_buffer_requests_for_region(self):
        user = Factories.create_user()
        org = Factories.create_organization(owner=user, region="us")
        app = Factories.create_sentry_app(
            name="demo-app",
            user=user,
            organization=org,
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

        buffer = SentryAppWebhookRequestsBuffer(app)
        buffer.add_request(
            response_code=200,
            org_id=org.id,
            event="issue.assigned",
            url=app.webhook_url,
        )
        requests = region_app_service.get_buffer_requests_for_region(
            sentry_app=app, region_name="us"
        )
        assert len(requests) == 1
        assert requests[0].organization_id == org.id

    def test_get_buffer_requests_for_region_error(self):
        user = Factories.create_user()
        org = Factories.create_organization(owner=user, region="us")
        app = Factories.create_sentry_app(
            name="demo-app",
            user=user,
            organization=org,
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

        buffer = SentryAppWebhookRequestsBuffer(app)
        buffer.add_request(
            response_code=200,
            org_id=org.id,
            event="issue.assigned",
            url="https://example.com/hook",
            error_id="d5111da2c28645c5889d072017e3445d",
            project_id=1,
        )
        requests = region_app_service.get_buffer_requests_for_region(
            sentry_app=app, region_name="us"
        )
        assert len(requests) == 1
        assert requests[0].error_id == "d5111da2c28645c5889d072017e3445d"
        assert requests[0].project_id == 1

    def test_filtered_get_buffer_requests_for_region(self):
        user = Factories.create_user()
        org = Factories.create_organization(owner=user, region="us")
        app = Factories.create_sentry_app(
            name="demo-app",
            user=user,
            organization=org,
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

        buffer = SentryAppWebhookRequestsBuffer(app)
        buffer.add_request(
            response_code=200,
            org_id=org.id,
            event="issue.assigned",
            url=app.webhook_url,
        )
        buffer.add_request(
            response_code=200,
            org_id=org.id,
            event="issue.resolved",
            url=app.webhook_url,
        )
        filter: SentryAppRequestFilterArgs = {"event": "issue.assigned"}
        requests = region_app_service.get_buffer_requests_for_region(
            sentry_app=app, region_name="us", filter=filter
        )
        assert len(requests) == 1
        assert requests[0].organization_id == org.id
