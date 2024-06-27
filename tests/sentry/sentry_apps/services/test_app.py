from sentry.sentry_apps.services.app import app_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test


@django_db_all(transaction=True)
@all_silo_test
def test_create_internal_integration_for_channel_request() -> None:
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
def test_find_alertable_services() -> None:
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


@django_db_all(transaction=True)
@all_silo_test
def test_get_component_contexts() -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    other_org = Factories.create_organization(owner=user)
    app = Factories.create_sentry_app(
        name="demo-app",
        user=user,
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
    install = Factories.create_sentry_app_installation(
        organization=org,
        slug=app.slug,
    )
    install_other = Factories.create_sentry_app_installation(
        organization=other_org,
        slug=app.slug,
    )
    # wrong component type
    result = app_service.get_component_contexts(filter={"app_ids": [app.id]}, component_type="derp")
    assert len(result) == 0

    # filter by app_id gets all installs
    result = app_service.get_component_contexts(
        filter={"app_ids": [app.id]}, component_type="alert-rule-trigger"
    )
    assert len(result) == 2
    for row in result:
        assert row.installation.id in {install.id, install_other.id}
        assert row.installation.sentry_app.slug == app.slug
        assert row.component.sentry_app_id == app.id
        assert row.component.app_schema

    # filter by install_uuid gets only one
    result = app_service.get_component_contexts(
        filter={"uuids": [install.uuid]}, component_type="alert-rule-trigger"
    )
    assert len(result) == 1
    row = result[0]
    assert row.installation.id == install.id
    assert row.installation.sentry_app.slug == app.slug
    assert row.component.sentry_app_id == app.id
    assert row.component.app_schema
