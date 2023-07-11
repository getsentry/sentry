import pytest
from django.db import transaction

from sentry.db.postgres.transactions import (
    django_test_transaction_water_mark,
    in_test_assert_no_transaction,
    in_test_hide_transaction_boundary,
)
from sentry.testutils import TestCase, TransactionTestCase
from sentry.testutils.silo import all_silo_test
from sentry.utils.pytest.fixtures import django_db_all


class CaseMixin:
    def test_in_test_assert_no_transaction(self):
        def do_assertions():
            in_test_assert_no_transaction("Not, in transaction, should not fail")

            with pytest.raises(AssertionError):
                with transaction.atomic():
                    in_test_assert_no_transaction("In transaction, should assert")

            with transaction.atomic():
                with in_test_hide_transaction_boundary():
                    in_test_assert_no_transaction("Guarded, should not assert")

        do_assertions()
        with transaction.atomic(), django_test_transaction_water_mark():
            do_assertions()

    def test_transaction_on_commit(self):
        def do_assertions():
            calls = []
            transaction.on_commit(lambda: calls.append("a"))

            with transaction.atomic():
                with transaction.atomic():
                    with pytest.raises(AssertionError):
                        with transaction.atomic():
                            transaction.on_commit(lambda: calls.append("no go"))
                            raise AssertionError("Oh no!")
                    transaction.on_commit(lambda: calls.append("b"))
                transaction.on_commit(lambda: calls.append("c"))
                assert calls == ["a"]

            assert calls == ["a", "b", "c"]

        do_assertions()
        with transaction.atomic(), django_test_transaction_water_mark():
            do_assertions()


@all_silo_test(stable=True)
class TestDjangoTestCaseTransactions(CaseMixin, TestCase):
    pass


@all_silo_test(stable=True)
class TestDjangoTransactionTestCaseTransactions(CaseMixin, TransactionTestCase):
    pass


class TestPytestDjangoDbAll(CaseMixin):
    @all_silo_test(stable=True)
    @django_db_all
    def test_in_test_assert_no_transaction(self):
        super().test_in_test_assert_no_transaction()

    @all_silo_test(stable=True)
    @django_db_all
    def test_transaction_on_commit(self):
        super().test_transaction_on_commit()
