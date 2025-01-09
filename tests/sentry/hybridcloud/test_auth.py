from sentry.adoption import manager as adoption_manager
from sentry.auth.services.auth import (
    RpcAuthProvider,
    RpcAuthProviderFlags,
    RpcOrganizationAuthConfig,
    auth_service,
)
from sentry.models.apikey import ApiKey
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.featureadoption import FeatureAdoption
from sentry.signals import receivers_raise_on_send
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, control_silo_test


@django_db_all(transaction=True)
@all_silo_test
def test_get_org_auth_config() -> None:
    org_with_many_api_keys = Factories.create_organization()
    org_without_api_keys = Factories.create_organization()
    Factories.create_organization()  # unrelated, not in the results.

    with assume_test_silo_mode(SiloMode.CONTROL):
        ApiKey.objects.create(organization_id=org_with_many_api_keys.id)
        ApiKey.objects.create(organization_id=org_with_many_api_keys.id)
        ap = AuthProvider.objects.create(
            organization_id=org_without_api_keys.id,
            provider="dummy",
            config={"domain": "olddomain.com"},
        )
        ap.flags.allow_unlinked = True
        ap.save()

    result = auth_service.get_org_auth_config(
        organization_ids=[org_without_api_keys.id, org_with_many_api_keys.id]
    )

    assert sorted(result, key=lambda v: v.organization_id) == [
        RpcOrganizationAuthConfig(
            organization_id=org_with_many_api_keys.id, auth_provider=None, has_api_key=True
        ),
        RpcOrganizationAuthConfig(
            organization_id=org_without_api_keys.id,
            auth_provider=RpcAuthProvider(
                id=ap.id,
                organization_id=org_without_api_keys.id,
                provider="dummy",
                flags=RpcAuthProviderFlags(
                    allow_unlinked=True,
                    scim_enabled=False,
                ),
                config=ap.config,
                default_role=ap.default_role,
                default_global_access=ap.default_global_access,
            ),
            has_api_key=False,
        ),
    ]


@control_silo_test
@django_db_all(transaction=True)
def test_enable_sso() -> None:
    org = Factories.create_organization()
    provider_key = "fly"
    provider_config = {"id": "x123x"}
    auth_service.enable_partner_sso(
        organization_id=org.id, provider_key=provider_key, provider_config=provider_config
    )
    auth_provider_query = AuthProvider.objects.filter(
        organization_id=org.id, provider=provider_key, config=provider_config
    )
    assert auth_provider_query.count() == 1

    # Re-enabling SSO should not create a new auth provider
    auth_service.enable_partner_sso(
        organization_id=org.id, provider_key=provider_key, provider_config=provider_config
    )
    auth_provider_query = AuthProvider.objects.filter(
        organization_id=org.id, provider=provider_key, config=provider_config
    )
    assert auth_provider_query.count() == 1


@control_silo_test
@django_db_all(transaction=True)
def test_enable_sso_user_triggers_signal() -> None:
    org = Factories.create_organization()
    user = Factories.create_user()

    provider_key = "fly"
    provider_config = {"id": "x123x"}
    with receivers_raise_on_send():
        auth_service.enable_partner_sso(
            organization_id=org.id,
            provider_key=provider_key,
            provider_config=provider_config,
            user_id=user.id,
        )
    auth_provider_query = AuthProvider.objects.filter(
        organization_id=org.id, provider=provider_key, config=provider_config
    )
    assert auth_provider_query.count() == 1
    with outbox_runner():
        pass
    with assume_test_silo_mode(SiloMode.REGION):
        adopted = FeatureAdoption.objects.filter().first()
        assert adopted
        assert adopted.feature_id == adoption_manager.get_by_slug("sso").id


@control_silo_test
@django_db_all(transaction=True)
def test_do_not_enable_sso_if_equivalent_provider_exists() -> None:
    org = Factories.create_organization()
    provider_key = "fly"
    equivalent_provider_key = "fly-non-partner"
    provider_config = {"id": "x123x"}
    auth_service.enable_partner_sso(
        organization_id=org.id,
        provider_key=equivalent_provider_key,
        provider_config=provider_config,
    )
    auth_provider_query = AuthProvider.objects.filter(
        organization_id=org.id, provider=equivalent_provider_key, config=provider_config
    )
    assert auth_provider_query.count() == 1

    auth_service.enable_partner_sso(
        organization_id=org.id,
        provider_key=provider_key,
        provider_config=provider_config,
        equivalent_providers=[equivalent_provider_key],
    )
    auth_provider_query = AuthProvider.objects.filter(
        organization_id=org.id, provider=provider_key, config=provider_config
    )
    assert auth_provider_query.count() == 0
    auth_provider_query = AuthProvider.objects.filter(
        organization_id=org.id, provider=equivalent_provider_key, config=provider_config
    )
    assert auth_provider_query.count() == 1


@control_silo_test
@django_db_all(transaction=True)
def test_create_auth_identity_for_equivalent_provider() -> None:
    org = Factories.create_organization()
    user = Factories.create_user()
    provider_key = "fly"
    equivalent_provider_key = "fly-non-partner"
    provider_config = {"id": "x123x"}
    auth_service.enable_partner_sso(
        organization_id=org.id,
        provider_key=equivalent_provider_key,
        provider_config=provider_config,
    )
    equivalent_auth_provider = AuthProvider.objects.filter(
        organization_id=org.id, provider=equivalent_provider_key, config=provider_config
    ).first()
    assert equivalent_auth_provider
    assert not AuthProvider.objects.filter(organization_id=org.id, provider=provider_key).exists()

    ident = "x456x"
    auth_service.create_auth_identity(
        provider=provider_key,
        config=provider_config,
        user_id=user.id,
        ident=ident,
        equivalent_providers=[equivalent_provider_key],
    )
    assert AuthIdentity.objects.filter(auth_provider=equivalent_auth_provider, ident=ident)
    assert not AuthProvider.objects.filter(organization_id=org.id, provider=provider_key).exists()
