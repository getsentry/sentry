import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, router, transaction

from sentry.models.managed_ingest_domain import (
    InvalidManagedIngestDomainStateTransition,
    ManagedIngestDomain,
    normalize_hostname,
)
from sentry.testutils.cases import TestCase


class ManagedIngestDomainTest(TestCase):
    def test_normalizes_hostname(self) -> None:
        domain = self.create_managed_ingest_domain(
            project=self.project,
            hostname="  TÉST.Example.COM. ",
        )

        assert domain.hostname == "xn--tst-bma.example.com"

    def test_rejects_non_subdomains(self) -> None:
        with pytest.raises(ValidationError):
            normalize_hostname("example.com")
        with pytest.raises(ValidationError):
            normalize_hostname("https://errors.example.com")
        with pytest.raises(ValidationError):
            normalize_hostname("*.example.com")
        with pytest.raises(ValidationError):
            normalize_hostname("127.0.0.1")

    def test_hostname_and_project_are_unique(self) -> None:
        self.create_managed_ingest_domain(
            project=self.project,
            hostname="Errors.Example.com.",
        )

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(ManagedIngestDomain)),
        ):
            self.create_managed_ingest_domain(
                project=self.create_project(),
                hostname="errors.example.com",
            )

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(ManagedIngestDomain)),
        ):
            self.create_managed_ingest_domain(
                project=self.project,
                hostname="other.example.com",
            )

    def test_status_transitions(self) -> None:
        domain = self.create_managed_ingest_domain(project=self.project)

        domain.transition_to(ManagedIngestDomain.Status.PENDING_DNS)
        domain.transition_to(ManagedIngestDomain.Status.PENDING_CERTIFICATE)
        domain.transition_to(ManagedIngestDomain.Status.ACTIVE)

        assert domain.status == ManagedIngestDomain.Status.ACTIVE
        assert domain.activated_at is not None

        domain.transition_to(ManagedIngestDomain.Status.ACTIVE)

    def test_rejects_invalid_status_transition(self) -> None:
        domain = self.create_managed_ingest_domain(project=self.project)
        domain.transition_to(ManagedIngestDomain.Status.PENDING_DNS)
        domain.transition_to(ManagedIngestDomain.Status.PENDING_CERTIFICATE)
        domain.transition_to(ManagedIngestDomain.Status.ACTIVE)

        with pytest.raises(InvalidManagedIngestDomainStateTransition):
            domain.transition_to(ManagedIngestDomain.Status.CREATING)
