from typing import Any, Dict, List, Optional

from django.db import router, transaction

from sentry.models.organizationslugreservation import (
    OrganizationSlugReservation,
    OrganizationSlugReservationType,
)
from sentry.models.organizationslugreservationreplica import OrganizationSlugReservationReplica
from sentry.models.outbox import outbox_context
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, create_test_regions


@control_silo_test(regions=create_test_regions("us"))
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
        org_slug_reservations: Dict[str, OrganizationSlugReservation] = {
            org_slug.slug: org_slug for org_slug in list(OrganizationSlugReservation.objects.all())
        }

        with assume_test_silo_mode(SiloMode.REGION):
            org_slug_replicas: Dict[str, OrganizationSlugReservationReplica] = {
                org_slug_r.slug: org_slug_r
                for org_slug_r in list(OrganizationSlugReservationReplica.objects.all())
            }

        slug_reservations_missing_replicas: List[OrganizationSlugReservation] = []
        mismatched_slug_res_replicas: List[OrganizationSlugReservationReplica] = []
        for slug in org_slug_reservations:
            slug_res = org_slug_reservations.get(slug)
            assert slug_res is not None

            org_slug_reservation_replica: Optional[
                OrganizationSlugReservationReplica
            ] = org_slug_replicas.pop(slug, None)

            if org_slug_reservation_replica is None:
                slug_reservations_missing_replicas.append(slug_res)
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

        if (
            len(mismatched_slug_res_replicas) > 0
            or len(slug_reservations_missing_replicas) > 0
            or len(extraneous_replicas) > 0
        ):
            raise Exception(
                "One or more org slug replicas did not match\n"
                + f"mismatched replicas: {mismatched_slug_res_replicas}\n"
                + f"extraneous replicas: {extraneous_replicas}\n"
                + f"reservations missing replicas: {slug_reservations_missing_replicas}"
            )

    def create_org_slug_reservation(self, **kwargs: Any):
        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation = OrganizationSlugReservation(**kwargs)
            org_slug_reservation.save(unsafe_write=True)

        self.assert_all_replicas_match_slug_reservations()

        return org_slug_reservation

    def test_standard_replica(self):
        self.create_org_slug_reservation(
            slug="santry",
            user_id=self.user.id,
            organization_id=42,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

    def test_replica_deletion(self):
        org_slug_reservation = self.create_org_slug_reservation(
            slug="santry",
            user_id=self.user.id,
            organization_id=42,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation.delete()

        self.assert_all_replicas_match_slug_reservations()

    def test_replica_deletion_with_pending_changes(self):
        org_slug_reservation = self.create_org_slug_reservation(
            slug="santry",
            user_id=self.user.id,
            organization_id=42,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        with outbox_context(flush=False):
            org_slug_reservation.update(slug="newsantry", unsafe_write=True)
            org_slug_reservation.update(slug="newsantry", unsafe_write=True)

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation.delete()

        self.assert_all_replicas_match_slug_reservations()

    def test_replica_update(self):
        org_slug_reservation = self.create_org_slug_reservation(
            slug="santry",
            user_id=self.user.id,
            organization_id=42,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        org_slug_reservation.slug = "newslug"
        org_slug_reservation.reservation_type = OrganizationSlugReservationType.VANITY_ALIAS

        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation.save(unsafe_write=True)

        self.assert_all_replicas_match_slug_reservations()

    def test_slug_update_only(self):
        org_slug_reservation = self.create_org_slug_reservation(
            slug="santry",
            user_id=self.user.id,
            organization_id=42,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        org_slug_reservation.slug = "newslug"
        with outbox_context(
            transaction.atomic(using=router.db_for_write(OrganizationSlugReservation))
        ):
            org_slug_reservation.save(unsafe_write=True)

        self.assert_all_replicas_match_slug_reservations()

    def test_delete_and_slug_change(self):
        org_slug_res_a = self.create_org_slug_reservation(
            slug="santry",
            user_id=self.user.id,
            organization_id=42,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        org_slug_res_b = self.create_org_slug_reservation(
            slug="acme",
            user_id=self.user.id,
            organization_id=43,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        with outbox_context(flush=False):
            org_slug_res_a.delete()
            org_slug_res_b.update(unsafe_write=True, slug="santry")

        with outbox_runner():
            pass

        self.assert_all_replicas_match_slug_reservations()

    def test_multi_rename_collision(self):
        org_slug_res_a = self.create_org_slug_reservation(
            slug="santry",
            user_id=self.user.id,
            organization_id=42,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        org_slug_res_b = self.create_org_slug_reservation(
            slug="acme",
            user_id=self.user.id,
            organization_id=43,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        org_slug_res_c = self.create_org_slug_reservation(
            slug="foobar",
            user_id=self.user.id,
            organization_id=44,
            region_name="us",
            reservation_type=OrganizationSlugReservationType.PRIMARY,
        )

        with outbox_context(flush=False):
            org_slug_res_a.update(slug="newsantry", unsafe_write=True)
            org_slug_res_b.update(slug="santry", unsafe_write=True)
            org_slug_res_c.update(slug="acme", unsafe_write=True)
            org_slug_res_a.update(slug="foobar", unsafe_write=True)

        with outbox_runner():
            pass

        self.assert_all_replicas_match_slug_reservations()
