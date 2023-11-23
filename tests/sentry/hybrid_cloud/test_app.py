from sentry.services.hybrid_cloud.app import app_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test


@django_db_all(transaction=True)
@all_silo_test
def test_create_internal_integration_for_channel_request():
    org = Factories.create_organization()
    integration_creator = Factories.create_user(email="test@sentry.io")
    first_app = app_service.create_internal_integration_for_channel_request(
        organization_id=org.id,
        integration_name="Test Integration",
        integration_scopes=["prject:read"],
        integration_creator_id=integration_creator.id,
        metadata={"partnership_restricted": True},
    )
    assert first_app.sentry_app.metadata["partnership_restricted"]

    second_app = app_service.create_internal_integration_for_channel_request(
        organization_id=org.id,
        integration_creator_id=integration_creator.id,
        integration_name="Test Integration",
        integration_scopes=["prject:read"],
    )
    assert first_app.id == second_app.id


@django_db_all(transaction=True)
@all_silo_test
def test_find_alertable_services():
    org = Factories.create_organization()
    app1 = Factories.create_internal_integration(organization_id=org.id, is_alertable=True)
    app2 = Factories.create_internal_integration(organization_id=org.id, is_alertable=True)
    Factories.create_internal_integration(
        organization_id=org.id,
        is_alertable=False,
    )

    services = app_service.find_alertable_services(organization_id=org.id)
    assert len(services) == 2
    assert services[0].title in [app1.name, app2.name]
    assert services[1].title in [app1.name, app2.name]
