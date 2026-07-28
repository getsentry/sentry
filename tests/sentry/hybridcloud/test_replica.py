from sentry.auth.services.auth.serial import serialize_auth_provider
from sentry.hybridcloud.models import ApiKeyReplica
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.hybridcloud.services.replica import cell_replica_service
from sentry.models.authidentity import AuthIdentity
from sentry.models.authidentityreplica import AuthIdentityReplica
from sentry.models.authprovider import AuthProvider
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode, create_test_cells


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
def test_replicate_auth_provider() -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)

    with assume_test_silo_mode(SiloMode.CELL):
        assert AuthProviderReplica.objects.count() == 0

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )

    with assume_test_silo_mode(SiloMode.CELL):
        replicated = AuthProviderReplica.objects.get(organization_id=org.id)

    assert replicated.auth_provider_id == auth_provider.id
    assert replicated.provider == auth_provider.provider
    assert replicated.config == auth_provider.config
    assert replicated.default_role == auth_provider.default_role
    assert replicated.default_global_access == auth_provider.default_global_access
    assert replicated.scim_enabled == auth_provider.flags.scim_enabled
    assert replicated.allow_unlinked == auth_provider.flags.allow_unlinked

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_provider.provider = "new_provider"
        auth_provider.flags.scim_enabled = not auth_provider.flags.scim_enabled
        auth_provider.save()

    with assume_test_silo_mode(SiloMode.CELL):
        replicated = AuthProviderReplica.objects.get(organization_id=org.id)

    assert replicated.auth_provider_id == auth_provider.id
    assert replicated.provider == auth_provider.provider
    assert replicated.scim_enabled == auth_provider.flags.scim_enabled

    serialized = serialize_auth_provider(auth_provider)
    serialized.organization_id = 99999

    # Should still succeed despite non existent organization
    cell_replica_service.upsert_replicated_auth_provider(auth_provider=serialized, cell_name="us")


@django_db_all(transaction=True)
@all_silo_test
def test_replicate_api_key() -> None:
    org = Factories.create_organization()
    with assume_test_silo_mode(SiloMode.CONTROL):
        api_key = Factories.create_api_key(org, scope_list=["a", "b"])

    with assume_test_silo_mode(SiloMode.CELL):
        replicated = ApiKeyReplica.objects.get(apikey_id=api_key.id)

    assert replicated.get_scopes() == api_key.get_scopes()

    with assume_test_silo_mode(SiloMode.CONTROL):
        api_key.scope_list = ["a", "b", "c"]
        api_key.save()

    with assume_test_silo_mode(SiloMode.CELL):
        replicated = ApiKeyReplica.objects.get(apikey_id=api_key.id)

    assert replicated.get_scopes() == api_key.get_scopes()


@django_db_all(transaction=True)
@all_silo_test
def test_replicate_auth_identity() -> None:
    user = Factories.create_user()
    user2 = Factories.create_user()
    user3 = Factories.create_user()
    org = Factories.create_organization(owner=user)

    with assume_test_silo_mode(SiloMode.CELL):
        assert AuthIdentityReplica.objects.count() == 0

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )
        auth_identity = AuthIdentity.objects.create(
            user=user, auth_provider=auth_provider, ident="some-ident", data={"b": 2}
        )

    with assume_test_silo_mode(SiloMode.CELL):
        replicated = AuthIdentityReplica.objects.get(
            ident=auth_identity.ident, auth_provider_id=auth_provider.id
        )

    assert replicated.auth_identity_id == auth_identity.id
    assert replicated.auth_provider_id == auth_identity.auth_provider_id
    assert replicated.user_id == auth_identity.user_id
    assert replicated.data == auth_identity.data
    assert replicated.ident == auth_identity.ident

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_identity.data = {"v": "new data"}
        auth_identity.save()

    with assume_test_silo_mode(SiloMode.CELL):
        replicated = AuthIdentityReplica.objects.get(
            ident=auth_identity.ident, auth_provider_id=auth_provider.id
        )

    assert replicated.auth_identity_id == auth_identity.id
    assert replicated.data == auth_identity.data

    with assume_test_silo_mode(SiloMode.CONTROL):
        auth_identities = [
            auth_identity,
            AuthIdentity.objects.create(
                user=user2, auth_provider=auth_provider, ident="some-ident-2", data={"b": 2}
            ),
            AuthIdentity.objects.create(
                user=user3, auth_provider=auth_provider, ident="some-ident-3", data={"b": 2}
            ),
        ]
        auth_idents = [ai.ident for ai in auth_identities]
        conflicting_pairs = list(zip(auth_identities, [*auth_idents[1:], auth_idents[0]]))

        with outbox_runner(), outbox_context(flush=False):
            for ai in auth_identities:
                ai.ident += "-new"
                ai.save()

            for ai, next_ident in conflicting_pairs:
                ai.ident = next_ident
                ai.save()

        with assume_test_silo_mode(SiloMode.CELL):
            for ai, next_ident in zip(auth_identities, [*auth_idents[1:], auth_idents[0]]):
                assert AuthIdentityReplica.objects.get(auth_identity_id=ai.id).ident == next_ident
