from django.db import router, transaction
from django.db.models import Q

from sentry.models import (
    OrganizationSlugReservation,
    OrganizationSlugReservationReplica,
    OrganizationSlugReservationType,
    outbox_context,
)
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test(stable=True)
class TestOrganizationSlugReservationReplication(TestCase):
    def assert_replica_matches_slug_reservation(self, slug_res: OrganizationSlugReservation):
        with assume_test_silo_mode(SiloMode.REGION):
            org_slug_reservation_replica = OrganizationSlugReservationReplica.objects.get(
                slug=slug_res.slug, organization_id=slug_res.organization_id
            )

        assert org_slug_reservation_replica.region_name == slug_res.region_name
        assert org_slug_reservation_replica.reservation_type == slug_res.reservation_type

    def assert_no_slug_replica(self, slug_res):
        with assume_test_silo_mode(SiloMode.REGION):
            org_slug_qs = OrganizationSlugReservationReplica.objects.filter(
                Q(slug=slug_res.slug) | Q(organization_id=slug_res.organization_id)
            )
        assert org_slug_qs.count() == 0

    def test_standard_replica(self):
        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation = OrganizationSlugReservation(
                slug="santry",
                user_id=self.user.id,
                organization_id=42,
                region_name="us",
                reservation_type=OrganizationSlugReservationType.PRIMARY,
            )
            org_slug_reservation.save(unsafe_write=True)
        self.assert_replica_matches_slug_reservation(org_slug_reservation)

    def test_replica_deletion(self):
        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation = OrganizationSlugReservation(
                slug="santry",
                user_id=self.user.id,
                organization_id=42,
                region_name="us",
                reservation_type=OrganizationSlugReservationType.PRIMARY,
            )
            org_slug_reservation.save(unsafe_write=True)

        self.assert_replica_matches_slug_reservation(org_slug_reservation)

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation.delete()

        self.assert_no_slug_replica(org_slug_reservation)

    def test_replica_update(self):
        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation = OrganizationSlugReservation(
                slug="santry",
                user_id=self.user.id,
                organization_id=42,
                region_name="us",
                reservation_type=OrganizationSlugReservationType.PRIMARY,
            )
            org_slug_reservation.save(unsafe_write=True)

        self.assert_replica_matches_slug_reservation(org_slug_reservation)
        org_slug_reservation.slug = "newslug"
        org_slug_reservation.reservation_type = OrganizationSlugReservationType.VANITY_ALIAS

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation.save(unsafe_write=True)

        self.assert_replica_matches_slug_reservation(org_slug_reservation)
