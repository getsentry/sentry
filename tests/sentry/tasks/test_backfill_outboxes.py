from typing import Type
from unittest.mock import patch

from django.apps import apps
from django.test.utils import override_settings

from sentry.db.models import BaseModel
from sentry.db.models.outboxes import run_outbox_replications_for_self_hosted
from sentry.models.authidentity import AuthIdentity
from sentry.models.authidentityreplica import AuthIdentityReplica
from sentry.models.authprovider import AuthProvider
from sentry.models.authproviderreplica import AuthProviderReplica
from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.outbox import ControlOutbox, RegionOutbox, outbox_context
from sentry.silo import SiloMode
from sentry.tasks.backfill_outboxes import (
    backfill_outboxes_for,
    get_backfill_key,
    get_processing_state,
    process_outbox_backfill_batch,
)
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import (
    assume_test_silo_mode,
    control_silo_test,
    no_silo_test,
    region_silo_test,
)
from sentry.utils import redis


def reset_processing_state():
    with redis.clusters.get("default").get_local_client_for_key("backfill_outboxes") as client:
        for app_models in apps.all_models.values():
            for model in app_models.values():
                client.delete(get_backfill_key(model._meta.db_table))


@django_db_all
@no_silo_test
def test_processing_awaits_options():
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

    assert not backfill_outboxes_for(SiloMode.REGION, 0, 1)
    with override_options(
        {
            "outbox_replication.sentry_organization.replication_version": Organization.replication_version
        }
    ):
        assert backfill_outboxes_for(SiloMode.REGION, 0, 1)


@django_db_all
@region_silo_test
def test_region_processing(task_runner):
    with outbox_context(flush=False):
        for i in range(5):
            Factories.create_organization()
    RegionOutbox.objects.all().delete()

    with outbox_runner(), task_runner():
        while backfill_outboxes_for(SiloMode.REGION, 0, 1, force_synchronous=True):
            pass
        assert RegionOutbox.objects.all().count() == 5

    assert RegionOutbox.objects.all().count() == 0
    with assume_test_silo_mode(SiloMode.CONTROL):
        assert OrganizationMapping.objects.all().count() == 5


@django_db_all
@control_silo_test
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

    def run_for_model(model: Type[BaseModel]):
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
        while backfill_outboxes_for(SiloMode.CONTROL, 0, 1, force_synchronous=True):
            pass

    assert OrganizationMapping.objects.all().count() == 2

    # Does not process these new objects since we already completed all available work for this version.
    with assume_test_silo_mode(SiloMode.REGION):
        assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 0
        AuthIdentityReplica.objects.all().delete()

    with patch("sentry.models.authidentity.AuthIdentity.replication_version", new=10000):
        with outbox_runner(), task_runner():
            while backfill_outboxes_for(SiloMode.CONTROL, 0, 1, force_synchronous=True):
                pass

        # Replicates it now that the version has bumped
        with assume_test_silo_mode(SiloMode.REGION):
            assert AuthIdentityReplica.objects.all().count() == 10
            assert AuthIdentityReplica.objects.filter(auth_provider_id=ap2.id).count() == 5
            assert AuthIdentityReplica.objects.filter(auth_provider_id=ap.id).count() == 5

        assert get_processing_state(AuthIdentity._meta.db_table)[1] == 10001


@django_db_all
@no_silo_test
def test_run_outbox_replications_for_self_hosted():
    reset_processing_state()

    with outbox_context(flush=False):
        org = Factories.create_organization()
        AuthProvider.objects.create(organization_id=org.id, provider="meethub", config={})

    ControlOutbox.objects.all().delete()
    RegionOutbox.objects.all().delete()

    with override_settings(SENTRY_SELF_HOSTED=True):
        run_outbox_replications_for_self_hosted()

    assert AuthProviderReplica.objects.count() == 1
    assert OrganizationMapping.objects.count() == 1
