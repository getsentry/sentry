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
    def does_replica_match_original_reservation(
        self,
        slug_reservation: OrganizationSlugReservation,
        slug_replica: OrganizationSlugReservationReplica,
    ):
        matches = slug_replica.organization_id == slug_reservation.organization_id
        matches = matches and slug_replica.region_name == slug_reservation.region_name
        matches = matches and slug_replica.reservation_type == slug_reservation.reservation_type

        return matches

    def assert_all_replicas_match_slug_reservations(self):
        org_slug_reservations = {
            org_slug.slug: org_slug for org_slug in list(OrganizationSlugReservation.objects.all())
        }

        with assume_test_silo_mode(SiloMode.REGION):
            org_slug_replicas = {
                org_slug_r.slug: org_slug_r
                for org_slug_r in list(OrganizationSlugReservationReplica.objects.all())
            }

        mismatched_slug_res_replicas = []
        for slug in org_slug_reservations:
            slug_res = org_slug_reservations.get(slug)
            org_slug_reservation_replica = org_slug_replicas.pop(slug, None)

            if org_slug_reservation_replica is None:
                mismatched_slug_res_replicas.append(org_slug_reservation_replica)
                continue

            matches = self.does_replica_match_original_reservation(
                slug_reservation=slug_res, slug_replica=org_slug_reservation_replica
            )

            if not matches:
                mismatched_slug_res_replicas.append(org_slug_reservation_replica)

        # Push the remaining replicas to the mismatch list as they are extraneous
        extraneous_replicas = []
        for slug in org_slug_replicas:
            extraneous_replicas.append(org_slug_replicas.get(slug))

        if len(mismatched_slug_res_replicas) > 0 or len(extraneous_replicas) > 0:
            raise Exception(
                "One or more org slug replicas did not match\n"
                + f"mismatched replicas: {mismatched_slug_res_replicas}\n"
                + f"extraneous replicas: {extraneous_replicas}"
            )

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
        self.assert_all_replicas_match_slug_reservations()

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

        self.assert_all_replicas_match_slug_reservations()

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

        self.assert_all_replicas_match_slug_reservations()
        org_slug_reservation.slug = "newslug"
        org_slug_reservation.reservation_type = OrganizationSlugReservationType.VANITY_ALIAS

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation.save(unsafe_write=True)

        self.assert_all_replicas_match_slug_reservations()
