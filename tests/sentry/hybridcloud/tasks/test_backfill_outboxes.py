from collections.abc import Callable
from typing import Any
from unittest.mock import patch

from django.apps import apps
from django.db import router, transaction
from django.test.utils import override_settings

from sentry.db.models import BaseModel
from sentry.hybridcloud.models.apitokenreplica import ApiTokenReplica
from sentry.hybridcloud.models.outbox import CellOutbox, ControlOutbox, outbox_context
from sentry.hybridcloud.outbox.base import run_outbox_replications_for_self_hosted
from sentry.hybridcloud.tasks.backfill_outboxes import (
    WATERMARK_MISSING_METRIC,
    WATERMARK_REPORT_ERROR_METRIC,
    WATERMARK_STATE_METRIC,
    WATERMARK_TARGET_VERSION_METRIC,
    WATERMARK_VERSION_METRIC,
    _backfill_models,
    _get_redis_client,
    backfill_outboxes_for,
    get_backfill_key,
    get_processing_state,
    process_outbox_backfill_batch,
    read_processing_state,
    set_processing_state,
)
from sentry.models.apitoken import ApiToken
from sentry.models.authidentity import AuthIdentity
from sentry.models.authidentityreplica import AuthIdentityReplica
from sentry.models.authprovider import AuthProvider
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import (
    assume_test_silo_mode,
    control_silo_test,
    create_test_cells,
    no_silo_test,
)
from sentry.users.models.user import User
from sentry.utils import redis


def reset_processing_state() -> None:
    with redis.clusters.get("default").get_local_client_for_key("backfill_outboxes") as client:
        for app_models in apps.all_models.values():
            for model in app_models.values():
                client.delete(get_backfill_key(model._meta.db_table))


@django_db_all
@no_silo_test
def test_processing_awaits_options() -> None:
    reset_processing_state()
    org = Factories.create_organization()
    with outbox_context(flush=False):
        AuthProvider.objects.create(organization_id=org.id, provider="meethub", config={})

    assert not backfill_outboxes_for(SiloMode.CONTROL, 0, 1)
    with override_options(
        {
            "outbox_replication.sentry_authprovider.replication_version": AuthProvider.replication_version
        }
    ):
        assert backfill_outboxes_for(SiloMode.CONTROL, 0, 1)

    assert not backfill_outboxes_for(SiloMode.CELL, 0, 1)
    with override_options(
        {
            "outbox_replication.sentry_organization.replication_version": Organization.replication_version
        }
    ):
        assert backfill_outboxes_for(SiloMode.CELL, 0, 1)


@django_db_all
def test_cell_processing(task_runner: Callable[..., Any]) -> None:
    with outbox_context(flush=False):
        for i in range(5):
            Factories.create_organization()
    CellOutbox.objects.all().delete()

    with outbox_runner(), task_runner():
        while backfill_outboxes_for(SiloMode.CELL, 0, 1, force_synchronous=True):
            pass
        assert CellOutbox.objects.all().count() == 5

    assert CellOutbox.objects.all().count() == 0
    with assume_test_silo_mode(SiloMode.CONTROL):
        assert OrganizationMapping.objects.all().count() == 5


@django_db_all
@control_silo_test
def test_control_processing_auth(task_runner: Callable[..., Any]) -> None:
    reset_processing_state()

    org = Factories.create_organization()
    with outbox_context(flush=False):
        ap = AuthProvider.objects.create(organization_id=org.id, provider="meethub", config={})
        for i in range(5):
            user = Factories.create_user()
            AuthIdentity.objects.create(user=user, auth_provider=ap, ident=str(i), data={})

    # Clear existing outboxes, force replication by hand
    ControlOutbox.objects.all().delete()

    assert not ControlOutbox.objects.all().exists()
    with assume_test_silo_mode(SiloMode.CELL):
        assert not AuthProviderReplica.objects.filter(auth_provider_id=ap.id).exists()
        assert not AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).exists()

    def run_for_model(model: type[BaseModel]) -> None:
        while True:
            if process_outbox_backfill_batch(model, 1, force_synchronous=True) is None:
                break

    with task_runner():
        run_for_model(AuthIdentity)
        run_for_model(AuthProvider)

    assert (
        get_processing_state(AuthIdentity._meta.db_table)[1] == AuthIdentity.replication_version + 1
    )

    with outbox_runner():
        assert ControlOutbox.objects.all().count() == 6
        with assume_test_silo_mode(SiloMode.CELL):
            assert not AuthProviderReplica.objects.filter(auth_provider_id=ap.id).exists()
            assert not AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).exists()

    with assume_test_silo_mode(SiloMode.CELL):
        assert AuthProviderReplica.objects.filter(auth_provider_id=ap.id).exists()
        assert AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).count() == 5

    with outbox_context(flush=False):
        org2 = Factories.create_organization()
        ap2 = AuthProvider.objects.create(organization_id=org2.id, provider="meethub", config={})
        for i in range(5):
            user = Factories.create_user()
            AuthIdentity.objects.create(user=user, auth_provider=ap2, ident=str(i), data={})

    # Clear again
    ControlOutbox.objects.all().delete()

    with assume_test_silo_mode(SiloMode.CELL):
        assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 0

    with outbox_runner(), task_runner():
        while backfill_outboxes_for(SiloMode.CONTROL, 0, 1, force_synchronous=True):
            pass

    assert OrganizationMapping.objects.all().count() == 2

    # No new outboxes as replication version hasn't changed.
    assert ControlOutbox.objects.all().count() == 0
    # Does not process these new objects since we already completed all available work for this version.
    with assume_test_silo_mode(SiloMode.CELL):
        assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 0
        AuthIdentityReplica.objects.all().delete()

    with patch("sentry.models.authidentity.AuthIdentity.replication_version", new=10000):
        with outbox_runner(), task_runner():
            while backfill_outboxes_for(SiloMode.CONTROL, 0, 1, force_synchronous=True):
                pass

            # Replication version was incremented, both sets of records need
            # replica updates.
            assert ControlOutbox.objects.all().count() == 10

        # Replicates it now that the version has bumped, and outboxes run by outbox_runner
        with assume_test_silo_mode(SiloMode.CELL):
            assert AuthIdentityReplica.objects.all().count() == 10
            assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 5
            assert AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).count() == 5

        assert get_processing_state(AuthIdentity._meta.db_table)[1] == 10001


@django_db_all
@control_silo_test(cells=create_test_cells("us", "de"))
@override_options({"outbox_replication.sentry_apitoken.backfill.target_cells": ["us"]})
def test_control_processing_target_cells(task_runner: Callable[..., Any]) -> None:
    reset_processing_state()

    user = Factories.create_user()

    # Monkeypatch ApiToken.default_flush because it is a option driven attribute
    with (
        patch.object(ApiToken, "default_flush", False),
        outbox_context(transaction.atomic(using=router.db_for_write(ApiToken)), flush=False),
    ):
        first_token = Factories.create_user_auth_token(user)
        second_token = Factories.create_user_auth_token(user)

    # Clear existing outboxes, force replication by hand
    ControlOutbox.objects.all().delete()

    assert not ControlOutbox.objects.all().exists()
    with assume_test_silo_mode(SiloMode.CELL):
        assert not ApiTokenReplica.objects.filter(user_id=user.id).exists()

    def run_for_model(model: type[BaseModel]) -> None:
        while True:
            if process_outbox_backfill_batch(model, 1, force_synchronous=True) is None:
                break

    with task_runner():
        run_for_model(ApiToken)

    assert get_processing_state(ApiToken._meta.db_table)[1] == ApiToken.replication_version + 1

    with outbox_runner():
        assert ControlOutbox.objects.all().count() == 2
        assert ControlOutbox.objects.filter(cell_name="us").count() == 2
        assert ControlOutbox.objects.filter(cell_name="de").count() == 0
        with assume_test_silo_mode(SiloMode.CELL):
            assert not ApiTokenReplica.objects.filter(user_id=user.id).exists()

    with assume_test_silo_mode(SiloMode.CELL):
        # After outbox_runner() is complete replication should complete.
        assert ApiTokenReplica.objects.filter(apitoken_id=first_token.id).exists()
        assert ApiTokenReplica.objects.filter(apitoken_id=second_token.id).exists()


@django_db_all
@no_silo_test
def test_run_outbox_replications_for_self_hosted() -> None:
    reset_processing_state()

    with outbox_context(flush=False):
        org = Factories.create_organization()
        AuthProvider.objects.create(organization_id=org.id, provider="meethub", config={})

    ControlOutbox.objects.all().delete()
    CellOutbox.objects.all().delete()

    with override_settings(SENTRY_SELF_HOSTED=True):
        run_outbox_replications_for_self_hosted()

    assert AuthProviderReplica.objects.count() == 1
    assert OrganizationMapping.objects.count() == 1


def _gauge_values(metrics_mock: Any, name: str) -> dict[str, int]:
    """Collect {table_name: value} from the gauge calls made on a mocked metrics module."""
    found = {}
    for call in metrics_mock.gauge.call_args_list:
        if call.args[0] != name:
            continue
        found[call.kwargs["tags"]["table_name"]] = call.args[1]
    return found


def _counter_calls(metrics_mock: Any, name: str) -> int:
    return sum(1 for call in metrics_mock.incr.call_args_list if call.args[0] == name)


@django_db_all
@no_silo_test
def test_watermark_report_runs_without_budget() -> None:
    """The pass sits above the budget branch, so a starved tick still reports."""
    reset_processing_state()
    set_processing_state(AuthProvider._meta.db_table, 41, 1)

    with patch("sentry.hybridcloud.tasks.backfill_outboxes.metrics") as metrics_mock:
        # No budget at all, so the backfill loop itself does nothing.
        assert not backfill_outboxes_for(SiloMode.CONTROL, scheduled_count=10_000)

    assert _gauge_values(metrics_mock, WATERMARK_STATE_METRIC)[AuthProvider._meta.db_table] == 41


@django_db_all
@no_silo_test
def test_watermark_report_covers_a_finished_table() -> None:
    """A table past its target version returns None from the loop, but must still report."""
    reset_processing_state()
    table_name = AuthProvider._meta.db_table
    finished_version = AuthProvider.replication_version + 1
    set_processing_state(table_name, 0, finished_version)

    with patch("sentry.hybridcloud.tasks.backfill_outboxes.metrics") as metrics_mock:
        # Budget of 1, so the loop really runs. Every control table is past its
        # target version here, so the loop finds no work and writes nothing.
        assert not backfill_outboxes_for(SiloMode.CONTROL, 0, 1)

    # The loop did walk the tables: it created a key for every table that had none.
    assert read_processing_state(ApiToken._meta.db_table) == (0, 1)
    # It left the finished table alone.
    assert read_processing_state(table_name) == (0, finished_version)
    # The table is finished: its stored version is above every possible target.
    assert _gauge_values(metrics_mock, WATERMARK_STATE_METRIC)[table_name] == 0
    assert _gauge_values(metrics_mock, WATERMARK_VERSION_METRIC)[table_name] == finished_version
    assert _gauge_values(metrics_mock, WATERMARK_TARGET_VERSION_METRIC)[table_name] == 0
    assert _counter_calls(metrics_mock, WATERMARK_REPORT_ERROR_METRIC) == 0
    # Every other control table was cleared, so only they count as missing.
    assert _counter_calls(metrics_mock, WATERMARK_MISSING_METRIC) == (
        len(_backfill_models(SiloMode.CONTROL)) - 1
    )


@django_db_all
@no_silo_test
def test_watermark_report_creates_no_key() -> None:
    """Reporting must not write. get_processing_state would create (0, 1) on a miss."""
    reset_processing_state()
    models = _backfill_models(SiloMode.CONTROL)
    assert models

    with patch("sentry.hybridcloud.tasks.backfill_outboxes.metrics") as metrics_mock:
        backfill_outboxes_for(SiloMode.CONTROL, scheduled_count=10_000)

    client = _get_redis_client()
    for model in models:
        assert client.get(get_backfill_key(model._meta.db_table)) is None

    assert _counter_calls(metrics_mock, WATERMARK_MISSING_METRIC) == len(models)
    assert _counter_calls(metrics_mock, WATERMARK_REPORT_ERROR_METRIC) == 0
    assert _gauge_values(metrics_mock, WATERMARK_STATE_METRIC) == {}


@django_db_all
@no_silo_test
def test_watermark_report_leaves_a_stored_value_alone() -> None:
    """An existing key keeps its exact stored bytes after the pass."""
    reset_processing_state()
    table_name = AuthProvider._meta.db_table
    set_processing_state(table_name, 12345, 3)
    client = _get_redis_client()
    before = client.get(get_backfill_key(table_name))

    backfill_outboxes_for(SiloMode.CONTROL, scheduled_count=10_000)

    assert client.get(get_backfill_key(table_name)) == before
    assert read_processing_state(table_name) == (12345, 3)


@django_db_all
@no_silo_test
def test_watermark_report_continues_when_one_table_raises() -> None:
    """One bad table must not stop the walk, and must not fail the scheduler tick."""
    reset_processing_state()
    broken_table = AuthProvider._meta.db_table
    good_table = ApiToken._meta.db_table
    set_processing_state(good_table, 7, 1)

    real_read = read_processing_state

    def fail_for_one(table_name: str) -> tuple[int, int] | None:
        if table_name == broken_table:
            raise ValueError("boom")
        return real_read(table_name)

    with (
        patch("sentry.hybridcloud.tasks.backfill_outboxes.metrics") as metrics_mock,
        patch(
            "sentry.hybridcloud.tasks.backfill_outboxes.read_processing_state",
            side_effect=fail_for_one,
        ),
    ):
        # No exception escapes to the caller.
        backfill_outboxes_for(SiloMode.CONTROL, scheduled_count=10_000)

    assert _counter_calls(metrics_mock, WATERMARK_REPORT_ERROR_METRIC) == 1
    # The walk carried on past the broken table.
    assert _gauge_values(metrics_mock, WATERMARK_STATE_METRIC)[good_table] == 7


@django_db_all
@no_silo_test
def test_watermark_report_does_not_fail_the_tick_on_a_registry_error() -> None:
    """An error outside the per-table walk is caught too."""
    reset_processing_state()

    with (
        patch("sentry.hybridcloud.tasks.backfill_outboxes.metrics") as metrics_mock,
        patch(
            "sentry.hybridcloud.tasks.backfill_outboxes._backfill_models",
            side_effect=ValueError("boom"),
        ),
    ):
        backfill_outboxes_for(SiloMode.CONTROL, scheduled_count=10_000)

    assert _counter_calls(metrics_mock, WATERMARK_REPORT_ERROR_METRIC) == 1


@django_db_all
@no_silo_test
def test_backfill_stops_at_the_budget() -> None:
    """A spent budget must end the walk, not carry a non-positive batch size to later models.

    process_outbox_backfill_batch treats batch_size <= 0 as an empty page, reads
    has_more as False, and marks the table complete having produced nothing.
    """
    reset_processing_state()
    with outbox_context(flush=False):
        for _ in range(5):
            Factories.create_user()

    seen: list[int] = []
    real = process_outbox_backfill_batch

    def spy(model: Any, batch_size: int, force_synchronous: bool = False) -> Any:
        seen.append(batch_size)
        return real(model, batch_size, force_synchronous=force_synchronous)

    with (
        override_options(
            {"outbox_replication.auth_user.replication_version": User.replication_version}
        ),
        patch(
            "sentry.hybridcloud.tasks.backfill_outboxes.process_outbox_backfill_batch",
            side_effect=spy,
        ),
    ):
        backfill_outboxes_for(SiloMode.CONTROL, 0, 2)

    assert seen, "the walk never reached a model"
    assert [size for size in seen if size <= 0] == []
