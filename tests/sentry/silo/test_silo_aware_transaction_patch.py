import os
from typing import Any
from unittest.mock import patch

import pytest
from django.db import router, transaction
from django.test import override_settings

from sentry.models import Organization, OrganizationMapping
from sentry.silo import SiloMode
from sentry.silo.patches import silo_aware_transaction_patch
from sentry.silo.patches.silo_aware_transaction_patch import MismatchedSiloTransactionError
from sentry.testutils import TestCase


def is_running_in_split_db_mode() -> bool:
    return bool(os.environ.get("SENTRY_USE_SPLIT_DBS"))


class TestTransactionPatching(TestCase):
    def test_preserves_parent_patching(self):
        def other_patch(*args: Any, **kargs: Any) -> str:
            assert kargs["using"] == "default"
            return "other-patch"

        with patch("sentry.silo.patches.silo_aware_transaction_patch._patched", new=False), patch(
            "sentry.silo.patches.silo_aware_transaction_patch._default_atomic_impl", new=None
        ), patch(
            "sentry.silo.patches.silo_aware_transaction_patch._default_on_commit", new=None
        ), patch(
            "sentry.silo.patches.silo_aware_transaction_patch._default_get_connection", new=None
        ), patch(
            "django.db.transaction.atomic", new=other_patch
        ):
            silo_aware_transaction_patch.patch_silo_aware_atomic()
            assert transaction.atomic() == "other-patch"


class TestSiloAwareTransactionPatchInSingleDbMode(TestCase):
    @pytest.mark.skipif(is_running_in_split_db_mode(), reason="only runs in single db mode")
    def test_routes_to_correct_db_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            transaction_in_test = transaction.atomic()
            assert transaction_in_test.using == "default"

    @pytest.mark.skipif(is_running_in_split_db_mode(), reason="only runs in single db mode")
    def test_routes_to_correct_db_in_region_silo(self):

        with override_settings(SILO_MODE=SiloMode.REGION):
            transaction_in_test = transaction.atomic()
            assert transaction_in_test.using == "default"

    def test_correctly_accepts_using_for_atomic(self):
        transaction_in_test = transaction.atomic(using="foobar")
        assert transaction_in_test.using == "foobar"


class TestSiloAwareTransactionPatchInSplitDbMode(TestCase):
    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_routes_to_correct_db_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.REGION):
            transaction_in_test = transaction.atomic()
            assert transaction_in_test.using == "default"

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_fails_if_silo_mismatch_with_using_in_region_silo(self):
        with override_settings(SILO_MODE=SiloMode.REGION), pytest.raises(
            MismatchedSiloTransactionError
        ):
            transaction.atomic(using=router.db_for_write(OrganizationMapping))

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_routes_to_correct_db_in_region_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            transaction_in_test = transaction.atomic()
            assert transaction_in_test.using == "control"

    @pytest.mark.skipif(not is_running_in_split_db_mode(), reason="only runs in split db mode")
    def test_fails_if_silo_mismatch_with_using_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL), pytest.raises(
            MismatchedSiloTransactionError
        ):
            transaction.atomic(using=router.db_for_write(Organization))
