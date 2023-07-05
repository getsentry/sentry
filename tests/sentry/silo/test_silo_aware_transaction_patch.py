import os

import pytest
from django.db import router
from django.test import override_settings

from sentry.models import Organization, OrganizationMapping
from sentry.silo import SiloMode
from sentry.silo.patches.silo_aware_transaction_patch import (
    MismatchedSiloTransactionError,
    siloed_atomic,
)
from sentry.testutils import TestCase


def is_running_in_split_db_mode() -> bool:
    return bool(os.environ.get("SENTRY_USE_SPLIT_DBS"))


class TestSiloAwareTransactionPatchInSingleDbMode(TestCase):
    @pytest.mark.skipif(is_running_in_split_db_mode(), reason="only runs in single db mode")
    def test_routes_to_correct_db_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            transaction_in_test = siloed_atomic()
            assert transaction_in_test.using == "default"

    @pytest.mark.skipif(is_running_in_split_db_mode(), reason="only runs in single db mode")
    def test_routes_to_correct_db_in_region_silo(self):

        with override_settings(SILO_MODE=SiloMode.REGION):
            transaction_in_test = siloed_atomic()
            assert transaction_in_test.using == "default"

    def test_correctly_accepts_using_for_atomic(self):
        transaction_in_test = siloed_atomic(using="foobar")
        assert transaction_in_test.using == "foobar"


class TestSiloAwareTransactionPatchInSplitDbMode(TestCase):
    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_routes_to_correct_db_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.REGION):
            transaction_in_test = siloed_atomic()
            assert transaction_in_test.using == "default"

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_fails_if_silo_mismatch_with_using_in_region_silo(self):
        with override_settings(SILO_MODE=SiloMode.REGION), pytest.raises(
            MismatchedSiloTransactionError
        ):
            siloed_atomic(using=router.db_for_write(OrganizationMapping))

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_routes_to_correct_db_in_region_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            transaction_in_test = siloed_atomic()
            assert transaction_in_test.using == "control"

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_fails_if_silo_mismatch_with_using_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL), pytest.raises(
            MismatchedSiloTransactionError
        ):
            siloed_atomic(using=router.db_for_write(Organization))
