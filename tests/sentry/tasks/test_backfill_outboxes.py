from unittest.mock import patch

import pytest
from django.apps import apps

from sentry.models import (
    AuthIdentity,
    AuthIdentityReplica,
    AuthProvider,
    AuthProviderReplica,
    ControlOutbox,
    outbox_context,
)
from sentry.silo import SiloMode
from sentry.tasks.backfill_outboxes import (
    get_backfill_key,
    get_processing_state,
    schedule_backfill_outbox_jobs_control,
)
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test
from sentry.utils import redis


@pytest.fixture(autouse=True)
def batch_size_one():
    with patch("sentry.tasks.backfill_outboxes.get_batch_size", return_value=1):
        yield


def reset_processing_state():
    with redis.clusters.get("default").get_local_client_for_key("backfill_outboxes") as client:
        for app_models in apps.all_models.values():
            for model in app_models.values():
                client.delete(get_backfill_key(model._meta.db_table))


@django_db_all
@control_silo_test(stable=True)
def test_control_processing(task_runner):
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
    with assume_test_silo_mode(SiloMode.REGION):
        assert not AuthProviderReplica.objects.filter(auth_provider_id=ap.id).exists()
        assert not AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).exists()

    with task_runner():
        schedule_backfill_outbox_jobs_control()

    assert (
        get_processing_state(AuthIdentity._meta.db_table)[1]
        == AuthIdentity.__replication_version__ + 1
    )

    with outbox_runner():
        assert ControlOutbox.objects.all().count() == 6
        with assume_test_silo_mode(SiloMode.REGION):
            assert not AuthProviderReplica.objects.filter(auth_provider_id=ap.id).exists()
            assert not AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).exists()

    with assume_test_silo_mode(SiloMode.REGION):
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

    with assume_test_silo_mode(SiloMode.REGION):
        assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 0

    with outbox_runner(), task_runner():
        schedule_backfill_outbox_jobs_control()

    # Does not process these new objects since we already completed all available work for this version.
    with assume_test_silo_mode(SiloMode.REGION):
        assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 0
        AuthIdentityReplica.objects.all().delete()

    with patch("sentry.models.authidentity.AuthIdentity.__replication_version__", new=10000):
        with outbox_runner(), task_runner():
            schedule_backfill_outbox_jobs_control()

        # Replicates it now that the version has bumped
        with assume_test_silo_mode(SiloMode.REGION):
            assert AuthIdentityReplica.objects.all().count() == 10
            assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 5
            assert AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).count() == 5

        assert get_processing_state(AuthIdentity._meta.db_table)[1] == 10001
