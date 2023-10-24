from sentry.models.integrations.sentry_app import SentryApp
from sentry.services.hybrid_cloud.app import app_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all(transaction=True)
def test_create_internal_integration_for_channel_request():
    org = Factories.create_organization()
    integration_creator = Factories.create_user(email="test@sentry.io")
    app_service.create_internal_integration_for_channel_request(
        organization_id=org.id,
        # email is ignored if id is provided during transition time
        integration_creator="another-test@sentry.io",
        integration_name="Test Integration",
        integration_scopes=["prject:read"],
        integration_creator_id=integration_creator.id,
    )
    sentry_app_query = SentryApp.objects.all()
    assert sentry_app_query.count() == 1
    app_service.create_internal_integration_for_channel_request(
        organization_id=org.id,
        integration_creator="test@sentry.io",
        integration_name="Test Integration",
        integration_scopes=["prject:read"],
    )
    sentry_app_query = SentryApp.objects.all()
    assert sentry_app_query.count() == 1
