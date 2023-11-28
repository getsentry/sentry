from typing import Any
from unittest.mock import patch

import pytest
from django.db import IntegrityError, router, transaction
from django.test import override_settings

from sentry.db.postgres.transactions import (
    django_test_transaction_water_mark,
    in_test_assert_no_transaction,
    in_test_hide_transaction_boundary,
)
from sentry.models.organization import Organization
from sentry.models.outbox import outbox_context
from sentry.models.user import User
from sentry.services.hybrid_cloud import silo_mode_delegation
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase, TransactionTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.hybrid_cloud import collect_transaction_queries
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import no_silo_test
from sentry.utils.snowflake import MaxSnowflakeRetryError


class CaseMixin:
    def test_collect_transaction_queries(self):
        with collect_transaction_queries() as queries, outbox_context(flush=False):
            Organization.objects.filter(name="org1").first()
            User.objects.filter(username="user1").first()

            with transaction.atomic(using=router.db_for_write(Organization)):
                try:
                    with transaction.atomic(using=router.db_for_write(Organization)):
                        Organization.objects.create(name=None)
                except (IntegrityError, MaxSnowflakeRetryError):
                    pass

            with transaction.atomic(using=router.db_for_write(Organization)):
                Organization.objects.create(name="org3")

            with transaction.atomic(using=router.db_for_write(User)):
                User.objects.create(username="user2")
                User.objects.create(username="user3")

        assert [(s["transaction"]) for s in queries] == [None, "default", "default", "control"]

    def test_bad_transaction_boundaries(self):

        org = Factories.create_organization()
        Factories.create_project(organization=org)
        Factories.create_user()

        with pytest.raises(AssertionError):
            with transaction.atomic(using=router.db_for_write(User)):
                Factories.create_project(organization=org)

    def test_safe_transaction_boundaries(self):
        org = Factories.create_organization()
        Factories.create_project(organization=org)
        Factories.create_user()

        with transaction.atomic(using=router.db_for_write(Organization)):
            Factories.create_project(organization=org)

            with django_test_transaction_water_mark():
                Factories.create_user()

            with django_test_transaction_water_mark(), transaction.atomic(
                using=router.db_for_write(User)
            ):
                Factories.create_user()

                with django_test_transaction_water_mark():
                    Factories.create_project(organization=org)

                Factories.create_user()

                with django_test_transaction_water_mark():
                    Factories.create_project(organization=org)
                    Factories.create_user()

            Factories.create_project(organization=org)
            with django_test_transaction_water_mark():
                Factories.create_user()

    def test_in_test_assert_no_transaction(self):
        def do_assertions():
            in_test_assert_no_transaction("Not, in transaction, should not fail")

            with pytest.raises(AssertionError):
                with transaction.atomic("default"):
                    in_test_assert_no_transaction("In transaction, should assert")

            with transaction.atomic("default"):
                with in_test_hide_transaction_boundary():
                    in_test_assert_no_transaction("Guarded, should not assert")

        do_assertions()
        with transaction.atomic("default"), django_test_transaction_water_mark():
            do_assertions()

    def test_transaction_on_commit(self):
        def do_assertions():
            calls = []
            transaction.on_commit(lambda: calls.append("a"), "default")

            with transaction.atomic("default"):
                with transaction.atomic("default"):
                    with pytest.raises(AssertionError):
                        with transaction.atomic("default"):
                            transaction.on_commit(lambda: calls.append("no go"), "default")
                            raise AssertionError("Oh no!")
                    transaction.on_commit(lambda: calls.append("b"), "default")
                transaction.on_commit(lambda: calls.append("c"), "default")
                assert calls == ["a"]

            assert calls == ["a", "b", "c"]

        do_assertions()
        with transaction.atomic("default"), django_test_transaction_water_mark():
            do_assertions()


@no_silo_test
class TestDjangoTestCaseTransactions(CaseMixin, TestCase):
    pass


@no_silo_test
class TestDjangoTransactionTestCaseTransactions(CaseMixin, TransactionTestCase):
    def test_collect_transaction_queries(self):
        return


class TestPytestDjangoDbAll(CaseMixin):
    @no_silo_test
    @django_db_all
    def test_in_test_assert_no_transaction(self):
        super().test_in_test_assert_no_transaction()

    @no_silo_test
    @django_db_all
    def test_transaction_on_commit(self):
        super().test_transaction_on_commit()

    @no_silo_test
    @django_db_all
    def test_safe_transaction_boundaries(self):
        super().test_safe_transaction_boundaries()

    @no_silo_test
    @django_db_all
    def test_bad_transaction_boundaries(self):
        super().test_bad_transaction_boundaries()

    @no_silo_test
    @django_db_all
    def test_collect_transaction_queries(self):
        super().test_collect_transaction_queries()


class FakeControlService:
    def a(self) -> int:
        return 1


class FakeRegionService:
    def a(self) -> int:
        return 2


@no_silo_test
class TestDelegatedByOpenTransaction(TestCase):
    def test_selects_mode_in_transaction_or_default(self):
        service: Any = silo_mode_delegation(
            {
                SiloMode.CONTROL: lambda: FakeControlService(),
                SiloMode.REGION: lambda: FakeRegionService(),
                SiloMode.MONOLITH: lambda: FakeRegionService(),
            }
        )

        with override_settings(SILO_MODE=SiloMode.CONTROL):
            assert service.a() == FakeControlService().a()
            with transaction.atomic(router.db_for_write(User)):
                assert service.a() == FakeControlService().a()

        with override_settings(SILO_MODE=SiloMode.REGION):
            assert service.a() == FakeRegionService().a()
            with transaction.atomic(router.db_for_write(Organization)):
                assert service.a() == FakeRegionService().a()

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            assert service.a() == FakeRegionService().a()
            with transaction.atomic(router.db_for_write(User)):
                assert service.a() == FakeControlService().a()


@no_silo_test
class TestDelegatedByOpenTransactionProduction(TransactionTestCase):
    @patch("sentry.services.hybrid_cloud.in_test_environment", return_value=False)
    def test_selects_mode_in_transaction_or_default(self, patch):
        service: Any = silo_mode_delegation(
            {
                SiloMode.CONTROL: lambda: FakeControlService(),
                SiloMode.REGION: lambda: FakeRegionService(),
                SiloMode.MONOLITH: lambda: FakeRegionService(),
            }
        )

        with override_settings(SILO_MODE=SiloMode.CONTROL):
            assert service.a() == FakeControlService().a()
            with transaction.atomic(router.db_for_write(User)):
                assert service.a() == FakeControlService().a()

        with override_settings(SILO_MODE=SiloMode.REGION):
            assert service.a() == FakeRegionService().a()
            with transaction.atomic(router.db_for_write(Organization)):
                assert service.a() == FakeRegionService().a()

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            assert service.a() == FakeRegionService().a()
            with transaction.atomic(router.db_for_write(User)):
                assert service.a() == FakeControlService().a()
