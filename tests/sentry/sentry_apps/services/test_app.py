from sentry.constants import SentryAppInstallationStatus
from sentry.sentry_apps.models.sentry_app_installation import SentryAppInstallation
from sentry.sentry_apps.services.app import app_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode_of


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
        assert row.component
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
    assert row.component
    assert row.component.sentry_app_id == app.id
    assert row.component.app_schema


@django_db_all(transaction=True)
@all_silo_test
def test_get_installation_component_contexts() -> None:
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

    no_component_app = Factories.create_sentry_app(
        name="no-component",
        user=user,
        published=True,
    )
    no_component_install = Factories.create_sentry_app_installation(
        organization=org,
        slug=no_component_app.slug,
    )
    no_component_install_other = Factories.create_sentry_app_installation(
        organization=other_org,
        slug=no_component_app.slug,
    )

    # wrong component type
    result = app_service.get_installation_component_contexts(
        filter={"app_ids": [app.id, no_component_app.id]},
        component_type="derp",
        include_contexts_without_component=False,
    )
    assert len(result) == 0

    # filter by app_id gets all installs for app
    result = app_service.get_installation_component_contexts(
        filter={"app_ids": [app.id]},
        component_type="alert-rule-trigger",
        include_contexts_without_component=False,
    )
    assert len(result) == 2
    for row in result:
        assert row.installation.id in {install.id, install_other.id}
        assert row.installation.sentry_app.slug == app.slug
        assert row.component
        assert row.component.sentry_app_id == app.id
        assert row.component.app_schema

    # filter by install_uuid gets only one
    result = app_service.get_installation_component_contexts(
        filter={"uuids": [install.uuid]},
        component_type="alert-rule-trigger",
        include_contexts_without_component=False,
    )
    assert len(result) == 1
    row = result[0]
    assert row.installation.id == install.id
    assert row.installation.sentry_app.slug == app.slug
    assert row.component
    assert row.component.sentry_app_id == app.id
    assert row.component.app_schema

    # filter by org_id and include app without component
    result = app_service.get_installation_component_contexts(
        filter={"organization_id": org.id},
        component_type="alert-rule-trigger",
        include_contexts_without_component=True,
    )
    assert len(result) == 2
    for row in result:
        assert row.installation.organization_id == org.id
        if row.installation.sentry_app.slug == app.slug:
            assert row.component
            assert row.component.sentry_app_id == app.id
            assert row.component.app_schema
        else:
            assert row.component is None

    # filter by app_id on app without component
    result = app_service.get_installation_component_contexts(
        filter={"app_ids": [no_component_app.id]},
        component_type="alert-rule-trigger",
        include_contexts_without_component=True,
    )
    assert len(result) == 2
    for row in result:
        assert row.installation.id in {no_component_install.id, no_component_install_other.id}
        assert row.installation.sentry_app.slug == no_component_app.slug
        assert row.component is None


@django_db_all(transaction=True)
@all_silo_test
def test_get_installation_org_id_by_token_id() -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    sentry_app = Factories.create_internal_integration(organization_id=org.id, is_alertable=True)
    token = Factories.create_internal_integration_token(user=user, internal_integration=sentry_app)

    result = app_service.get_installation_org_id_by_token_id(token_id=token.id)
    assert result == org.id

    with assume_test_silo_mode_of(SentryAppInstallation):
        install = sentry_app.installations.get(organization_id=org.id)
        install.status = SentryAppInstallationStatus.PENDING
        install.save()

    # Installation must be installed
    result = app_service.get_installation_org_id_by_token_id(token_id=token.id)
    assert result is None


@django_db_all(transaction=True)
@all_silo_test
def test_get_sentry_apps_for_organization() -> None:
    org = Factories.create_organization()
    other_org = Factories.create_organization()

    # Create internal integrations
    Factories.create_internal_integration(
        name="Test Integration",
        organization_id=org.id,
    )
    Factories.create_internal_integration(
        name="Test Integration",
        organization_id=other_org.id,
    )
    result = app_service.get_sentry_apps_for_organization(organization_id=org.id)
    assert len(result) == 1
    assert result[0].owner_id == org.id


@django_db_all(transaction=True)
@all_silo_test
def test_update_sentry_app() -> None:
    org = Factories.create_organization()

    sentry_app = Factories.create_internal_integration(
        name="Test Integration",
        organization_id=org.id,
        events=[
            "issue.resolved",
            "issue.unresolved",
            "issue.ignored",
            "issue.assigned",
            "error.created",
        ],
    )
    result = app_service.update_sentry_app(id=sentry_app.id, attrs=dict(events=["error.created"]))
    assert result
    assert result.events == ["error.created"]


@django_db_all(transaction=True)
@all_silo_test
def test_prepare_sentry_app_components_returns_none_for_nonexistent_installation() -> None:
    """Test that prepare_sentry_app_components returns None when installation doesn't exist"""
    # Use a non-existent installation ID
    result = app_service.prepare_sentry_app_components(
        installation_id=999999999,
        component_type="alert-rule-action",
    )
    assert result is None


@django_db_all(transaction=True)
@all_silo_test
def test_get_internal_integrations() -> None:
    org = Factories.create_organization()
    other_org = Factories.create_organization()

    # Create internal integrations
    internal_app = Factories.create_internal_integration(
        name="Test Integration",
        organization_id=org.id,
    )
    Factories.create_internal_integration(
        name="Test Integration",
        organization_id=other_org.id,
    )
    Factories.create_internal_integration(
        name="Different Integration",
        organization_id=org.id,
    )
    # Create a published app with same name (should not be returned)
    Factories.create_sentry_app(
        name="Test Integration",
        organization=org,
        published=True,
    )

    # Test finding internal integrations
    results = app_service.get_internal_integrations(
        organization_id=org.id,
        integration_name="Test Integration",
    )

    assert len(results) == 1
    assert results[0].name == "Test Integration"
    assert results[0].id == internal_app.id
    assert results[0].status == "internal"  # Status is serialized as string
    assert results[0].is_internal  # Helper property to check status

    # Test with non-existent name
    results = app_service.get_internal_integrations(
        organization_id=org.id,
        integration_name="Non-existent Integration",
    )
    assert len(results) == 0

    # Test with different organization
    results = app_service.get_internal_integrations(
        organization_id=12345,  # Non-existent org
        integration_name="Test Integration",
    )
    assert len(results) == 0
