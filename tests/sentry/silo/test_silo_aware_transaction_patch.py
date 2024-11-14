import pytest
from django.db import router
from django.test import override_settings

from sentry.models.organization import Organization
from sentry.models.organizationmapping import OrganizationMapping
from sentry.silo.base import SiloMode
from sentry.silo.patches.silo_aware_transaction_patch import (
    MismatchedSiloTransactionError,
    TransactionMissingDBException,
    is_in_test_case_body,
    siloed_atomic,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import no_silo_test


@no_silo_test
class TestSiloAwareTransactionPatchInSingleDbMode(TestCase):
    def test_correctly_accepts_using_for_atomic(self):
        transaction_in_test = siloed_atomic(using="foobar")
        assert transaction_in_test.using == "foobar"

    def test_accepts_cross_silo_atomics_in_monolith_mode(self):
        siloed_atomic(using=router.db_for_write(Organization))
        siloed_atomic(using=router.db_for_write(OrganizationMapping))


@no_silo_test  # use inline override_settings to test individual silo modes
class TestSiloAwareTransactionPatchInSplitDbMode(TestCase):
    def test_fails_if_silo_mismatch_with_using_in_region_silo(self):
        with (
            override_settings(SILO_MODE=SiloMode.REGION),
            pytest.raises(MismatchedSiloTransactionError),
        ):
            siloed_atomic(using=router.db_for_write(OrganizationMapping))

    def test_fails_if_silo_mismatch_with_using_in_control_silo(self):
        with (
            override_settings(SILO_MODE=SiloMode.CONTROL),
            pytest.raises(MismatchedSiloTransactionError),
        ):
            siloed_atomic(using=router.db_for_write(Organization))

    def test_fails_if_no_using_provided(self):
        with pytest.raises(TransactionMissingDBException):
            siloed_atomic()

    def test_accepts_control_silo_routing_in_control_silo(self):
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            siloed_atomic(using=router.db_for_write(OrganizationMapping))

    def test_accepts_control_silo_routing_in_region_silo(self):
        with override_settings(SILO_MODE=SiloMode.REGION):
            siloed_atomic(using=router.db_for_write(Organization))


@no_silo_test
def test_is_in_test_case_body():
    """Check that we can correctly detect that we are in a test case body.

    It is paradoxically impossible to test the negative case (without doing some
    additional, unwanted meta-magic), but false negatives will be conspicuous as
    MismatchedSiloTransactionErrors raised from bogus places.
    """
    assert is_in_test_case_body()


@no_silo_test
class TestIsInTestCaseBody(TestCase):
    """Repeat the function above in a test class, just in case doing so produces
    small differences in the execution stack."""

    def test_is_in_test_case_body(self):
        assert is_in_test_case_body()
