from unittest.mock import Mock, call, patch

import pytest

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


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.services.replica.impl.metrics")
def test_replica_write_records_created_then_updated(mock_metrics: Mock) -> None:
    user = Factories.create_user()
    org = Factories.create_organization(owner=user)
    mock_metrics.reset_mock()

    with assume_test_silo_mode(SiloMode.CELL):
        # The replica write runs in the cell; under MONOLITH the mode is monolith.
        expected_silo = SiloMode.get_current_mode().value.lower()

    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        auth_provider = AuthProvider.objects.create(
            organization_id=org.id, provider="abc", config={"a": 1}
        )
    with assume_test_silo_mode(SiloMode.CONTROL), outbox_runner():
        auth_provider.provider = "new_provider"
        auth_provider.save()

    write_tags = {"silo": expected_silo, "category": "AUTH_PROVIDER_UPDATE"}
    assert mock_metrics.incr.mock_calls == [
        call(
            "hybridcloud.replication.write",
            tags={**write_tags, "outcome": "created"},
        ),
        call(
            "hybridcloud.replication.write",
            tags={**write_tags, "outcome": "updated"},
        ),
    ]


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.services.replica.impl.metrics")
def test_replica_write_records_error_and_reraises(mock_metrics: Mock) -> None:
    from django.db import DataError

    from sentry.hybridcloud.services.replica.impl import handle_replication

    org = Factories.create_organization()
    with assume_test_silo_mode(SiloMode.CELL):
        # provider is varchar(128); Postgres rejects the save with a DataError.
        broken_replica = AuthProviderReplica(
            auth_provider_id=12345, organization_id=org.id, provider="x" * 200
        )
        with pytest.raises(DataError):
            handle_replication(AuthProvider, broken_replica)
        expected_silo = SiloMode.get_current_mode().value.lower()

    assert mock_metrics.incr.mock_calls == [
        call(
            "hybridcloud.replication.write",
            tags={"silo": expected_silo, "category": "AUTH_PROVIDER_UPDATE", "outcome": "error"},
        )
    ]


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.services.replica.impl.metrics")
def test_project_key_mapping_write_is_recorded(mock_metrics: Mock) -> None:
    from sentry.hybridcloud.services.project_key_mapping import RpcProjectKeyMapping
    from sentry.hybridcloud.services.replica import control_replica_service

    with assume_test_silo_mode(SiloMode.CONTROL):
        expected_silo = SiloMode.get_current_mode().value.lower()
        assert control_replica_service.upsert_project_key_mapping(
            project_key=RpcProjectKeyMapping(id=1, public_key="samekey", cell_name="us")
        )
        assert control_replica_service.upsert_project_key_mapping(
            project_key=RpcProjectKeyMapping(id=1, public_key="samekey", cell_name="us")
        )
        # public_key is unique, so a different project key with the same public_key conflicts.
        assert not control_replica_service.upsert_project_key_mapping(
            project_key=RpcProjectKeyMapping(id=2, public_key="samekey", cell_name="us")
        )

    tags = {"silo": expected_silo, "category": "PROJECT_KEY_UPDATE"}
    assert mock_metrics.incr.mock_calls == [
        call("hybridcloud.replication.write", tags={**tags, "outcome": "created"}),
        call("hybridcloud.replication.write", tags={**tags, "outcome": "updated"}),
        call("hybridcloud.replication.write", tags={**tags, "outcome": "conflict"}),
    ]


@django_db_all(transaction=True)
@all_silo_test(cells=create_test_cells("us"))
@patch("sentry.hybridcloud.services.replica.impl.metrics")
def test_organization_avatar_replica_write_is_recorded(mock_metrics: Mock) -> None:
    from sentry.hybridcloud.services.replica import control_replica_service

    org = Factories.create_organization()
    with assume_test_silo_mode(SiloMode.CONTROL):
        expected_silo = SiloMode.get_current_mode().value.lower()
        control_replica_service.upsert_organization_avatar_replica(
            organization_id=org.id, avatar_type=1, avatar_ident="abc"
        )
        control_replica_service.upsert_organization_avatar_replica(
            organization_id=org.id, avatar_type=1, avatar_ident="def"
        )

    tags = {"silo": expected_silo, "category": "ORGANIZATION_AVATAR_UPDATE"}
    assert mock_metrics.incr.mock_calls == [
        call("hybridcloud.replication.write", tags={**tags, "outcome": "created"}),
        call("hybridcloud.replication.write", tags={**tags, "outcome": "updated"}),
    ]
