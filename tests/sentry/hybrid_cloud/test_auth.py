from sentry.models.apikey import ApiKey
from sentry.models.authprovider import AuthProvider
from sentry.services.hybrid_cloud.auth import (
    RpcAuthProvider,
    RpcAuthProviderFlags,
    RpcOrganizationAuthConfig,
    auth_service,
)
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@django_db_all(transaction=True)
@all_silo_test
def test_get_org_auth_config():
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


@django_db_all(transaction=True)
def test_enable_sso():
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
