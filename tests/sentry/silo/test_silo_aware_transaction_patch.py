import os

import pytest
from django.db import router
from django.test import override_settings

from sentry.models import Organization, OrganizationMapping
from sentry.silo import SiloMode
from sentry.silo.patches.silo_aware_transaction_patch import (
    MismatchedSiloTransactionError,
    TransactionMissingDBException,
    siloed_atomic,
)
from sentry.testutils import TestCase


def is_running_in_split_db_mode() -> bool:
    return bool(os.environ.get("SENTRY_USE_SPLIT_DBS"))


class TestSiloAwareTransactionPatchInSingleDbMode(TestCase):
    def test_correctly_accepts_using_for_atomic(self):
        transaction_in_test = siloed_atomic(using="foobar")
        assert transaction_in_test.using == "foobar"

    def test_accepts_cross_silo_atomics_in_monolith_mode(self):
        siloed_atomic(using=router.db_for_write(Organization))
        siloed_atomic(using=router.db_for_write(OrganizationMapping))


class TestSiloAwareTransactionPatchInSplitDbMode(TestCase):
    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_fails_if_silo_mismatch_with_using_in_region_silo(self):
        with override_settings(SILO_MODE=SiloMode.REGION), pytest.raises(
            MismatchedSiloTransactionError
        ):
            siloed_atomic(using=router.db_for_write(OrganizationMapping))

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_fails_if_silo_mismatch_with_using_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL), pytest.raises(
            MismatchedSiloTransactionError
        ):
            siloed_atomic(using=router.db_for_write(Organization))

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_fails_if_no_using_provided(self):
        with pytest.raises(TransactionMissingDBException):
            siloed_atomic()

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_accepts_control_silo_routing_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            siloed_atomic(using=router.db_for_write(OrganizationMapping))

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_accepts_control_silo_routing_in_region_silo(self):
        with override_settings(SILO_MODE=SiloMode.REGION):
            siloed_atomic(using=router.db_for_write(Organization))
