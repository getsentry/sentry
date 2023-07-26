from sentry.models import ApiKey, AuthProvider
from sentry.services.hybrid_cloud.auth import (
    RpcAuthProvider,
    RpcAuthProviderFlags,
    RpcOrganizationAuthConfig,
    auth_service,
)
from sentry.silo import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.hybrid_cloud import use_real_service
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode
from sentry.utils.pytest.fixtures import django_db_all


@django_db_all(transaction=True)
@all_silo_test
@use_real_service(auth_service, None)
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
            ),
            has_api_key=False,
        ),
    ]
