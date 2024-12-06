from unittest.mock import Mock, patch
from uuid import UUID

from sentry.api.endpoints.organization_fork import (
    ERR_CANNOT_FORK_FROM_REGION,
    ERR_CANNOT_FORK_INTO_SAME_REGION,
    ERR_DUPLICATE_ORGANIZATION_FORK,
    ERR_ORGANIZATION_INACTIVE,
    ERR_ORGANIZATION_NOT_FOUND,
)
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.relocation import Relocation, RelocationFile
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, create_test_regions, region_silo_test

REQUESTING_TEST_REGION = "requesting"
EXPORTING_TEST_REGION = "exporting"
SAAS_TO_SAAS_TEST_REGIONS = create_test_regions(REQUESTING_TEST_REGION, EXPORTING_TEST_REGION)


@patch("sentry.analytics.record")
@patch("sentry.tasks.relocation.uploading_start.apply_async")
@region_silo_test(regions=SAAS_TO_SAAS_TEST_REGIONS)
class OrganizationForkTest(APITestCase):
    endpoint = "sentry-api-0-organization-fork"
    method = "POST"

    def setUp(self):
        super().setUp()
        self.superuser = self.create_user(is_superuser=True)
        self.staff_user = self.create_user(is_staff=True)
        self.existing_org_owner = self.create_user(
            email="existing_org_owner@example.com",
            is_superuser=False,
            is_staff=False,
            is_active=True,
        )

        self.requested_org_slug = "testing"
        self.existing_org = self.create_organization(
            name=self.requested_org_slug,
            owner=self.existing_org_owner,
            region=EXPORTING_TEST_REGION,
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_simple(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_success_response(self.existing_org.slug)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name
        assert response.data["scheduledPauseAtStep"] is None
        assert response.data["creator"]["id"] == str(self.superuser.id)
        assert response.data["creator"]["email"] == str(self.superuser.email)
        assert response.data["creator"]["username"] == str(self.superuser.username)
        assert response.data["owner"]["id"] == str(self.existing_org_owner.id)
        assert response.data["owner"]["email"] == str(self.existing_org_owner.email)
        assert response.data["owner"]["username"] == str(self.existing_org_owner.username)

        relocation: Relocation = Relocation.objects.get(owner_id=self.existing_org_owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == [self.requested_org_slug]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_simple_using_organization_id(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_success_response(self.existing_org.id)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name

        relocation: Relocation = Relocation.objects.get(owner_id=self.existing_org_owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == [self.requested_org_slug]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @override_options(
        {
            "relocation.enabled": True,
            "relocation.daily-limit.small": 1,
            "relocation.autopause.saas-to-saas": "IMPORTING",
        }
    )
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_with_valid_autopause_option(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)

        response = self.get_success_response(self.existing_org.slug)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name
        assert response.data["scheduledPauseAtStep"] == Relocation.Step.IMPORTING.name

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @override_options(
        {
            "relocation.enabled": True,
            "relocation.daily-limit.small": 1,
            "relocation.autopause.self-hosted": "IMPORTING",
        }
    )
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_with_untriggered_autopause_option(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)

        response = self.get_success_response(self.existing_org.slug)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name
        assert response.data["scheduledPauseAtStep"] is None

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @override_options(
        {"relocation.enabled": False, "relocation.daily-limit.small": 1, "staff.ga-rollout": True}
    )
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_staff_when_feature_disabled(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.staff_user, staff=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_success_response(self.existing_org.slug)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name
        assert response.data["scheduledPauseAtStep"] is None
        assert response.data["creator"]["id"] == str(self.staff_user.id)
        assert response.data["creator"]["email"] == str(self.staff_user.email)
        assert response.data["creator"]["username"] == str(self.staff_user.username)
        assert response.data["owner"]["id"] == str(self.existing_org_owner.id)
        assert response.data["owner"]["email"] == str(self.existing_org_owner.email)
        assert response.data["owner"]["username"] == str(self.existing_org_owner.username)

        relocation: Relocation = Relocation.objects.get(owner_id=self.existing_org_owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == [self.requested_org_slug]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @override_options({"relocation.enabled": False, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_superuser_when_feature_disabled(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_success_response(self.existing_org.slug)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name
        assert response.data["scheduledPauseAtStep"] is None
        assert response.data["creator"]["id"] == str(self.superuser.id)
        assert response.data["creator"]["email"] == str(self.superuser.email)
        assert response.data["creator"]["username"] == str(self.superuser.username)
        assert response.data["owner"]["id"] == str(self.existing_org_owner.id)
        assert response.data["owner"]["email"] == str(self.existing_org_owner.email)
        assert response.data["owner"]["username"] == str(self.existing_org_owner.username)

        relocation: Relocation = Relocation.objects.get(owner_id=self.existing_org_owner.id)
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == [self.requested_org_slug]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_bad_organization_not_found(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_error_response("does-not-exist", status_code=404)

        assert response.data.get("detail") == ERR_ORGANIZATION_NOT_FOUND.substitute(
            pointer="does-not-exist"
        )
        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_bad_organization_mapping_not_found(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrganizationMapping.objects.filter(slug=self.existing_org.slug).delete()

        response = self.get_error_response(self.existing_org.slug, status_code=404)

        assert response.data.get("detail") == ERR_ORGANIZATION_NOT_FOUND.substitute(
            pointer=self.existing_org.slug
        )
        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_bad_cannot_fork_deleted_organization(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)

        self.existing_org.status = OrganizationStatus.DELETION_IN_PROGRESS
        self.existing_org.save()

        with assume_test_silo_mode(SiloMode.CONTROL):
            org_mapping = OrganizationMapping.objects.get(slug=self.existing_org.slug)
            org_mapping.status = OrganizationStatus.DELETION_IN_PROGRESS
            org_mapping.save()

        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_error_response(self.existing_org.slug, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_ORGANIZATION_INACTIVE.substitute(
            slug=self.existing_org.slug,
            status="DELETION_IN_PROGRESS",
        )
        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    @patch(
        "sentry.api.endpoints.organization_fork.CANNOT_FORK_FROM_REGION", {EXPORTING_TEST_REGION}
    )
    def test_bad_organization_in_forbidden_region(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_error_response(self.existing_org.slug, status_code=403)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_CANNOT_FORK_FROM_REGION.substitute(
            region=EXPORTING_TEST_REGION,
        )
        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    # Note that for this test we've changed this to `EXPORTING_TEST_REGION`
    @assume_test_silo_mode(SiloMode.REGION, region_name=EXPORTING_TEST_REGION)
    def test_bad_organization_already_in_region(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_error_response(self.existing_org.slug, status_code=400)

        assert response.data.get("detail") is not None
        assert response.data.get("detail") == ERR_CANNOT_FORK_INTO_SAME_REGION.substitute(
            region=EXPORTING_TEST_REGION,
        )
        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

    for stat in [
        Relocation.Status.SUCCESS,
        Relocation.Status.FAILURE,
    ]:

        @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
        @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
        def test_good_completed_relocation_for_same_organization(
            self,
            uploading_start_mock: Mock,
            analytics_record_mock: Mock,
            stat=stat,
        ):
            self.login_as(user=self.superuser, superuser=True)
            Relocation.objects.create(
                creator_id=self.superuser.id,
                owner_id=self.existing_org_owner.id,
                want_org_slugs=[self.existing_org.slug],
                status=stat.value,
                step=Relocation.Step.COMPLETED.value,
                provenance=Relocation.Provenance.SAAS_TO_SAAS.value,
            )
            relocation_count = Relocation.objects.count()
            relocation_file_count = RelocationFile.objects.count()

            response = self.get_success_response(self.existing_org.slug)

            assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
            assert response.data["step"] == Relocation.Step.UPLOADING.name
            assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name

            relocation: Relocation = Relocation.objects.get(
                owner_id=self.existing_org_owner.id, status=Relocation.Status.IN_PROGRESS.value
            )
            assert str(relocation.uuid) == response.data["uuid"]
            assert relocation.want_org_slugs == [self.requested_org_slug]
            assert Relocation.objects.count() == relocation_count + 1
            assert RelocationFile.objects.count() == relocation_file_count

            assert uploading_start_mock.call_count == 1
            uploading_start_mock.assert_called_with(
                args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
            )

            assert analytics_record_mock.call_count == 1
            analytics_record_mock.assert_called_with(
                "relocation.forked",
                creator_id=int(response.data["creator"]["id"]),
                owner_id=int(response.data["owner"]["id"]),
                uuid=response.data["uuid"],
                from_org_slug=self.requested_org_slug,
                requesting_region_name=REQUESTING_TEST_REGION,
                replying_region_name=EXPORTING_TEST_REGION,
            )

    for stat in [
        Relocation.Status.IN_PROGRESS,
        Relocation.Status.PAUSE,
    ]:

        @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
        @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
        def test_bad_active_relocation_for_same_organization(
            self,
            uploading_start_mock: Mock,
            analytics_record_mock: Mock,
            stat=stat,
        ):
            self.login_as(user=self.superuser, superuser=True)
            existing_relocation = Relocation.objects.create(
                creator_id=self.superuser.id,
                owner_id=self.existing_org_owner.id,
                want_org_slugs=[self.existing_org.slug],
                status=stat.value,
                step=Relocation.Step.UPLOADING.value,
                provenance=Relocation.Provenance.SAAS_TO_SAAS.value,
            )

            response = self.get_error_response(self.existing_org.slug, status_code=409)

            assert response.data.get("detail") is not None
            assert response.data.get("detail") == ERR_DUPLICATE_ORGANIZATION_FORK.substitute(
                uuid=str(existing_relocation.uuid)
            )
            assert uploading_start_mock.call_count == 0
            assert analytics_record_mock.call_count == 0

    @override_options(
        {"relocation.enabled": True, "relocation.daily-limit.small": 1, "staff.ga-rollout": True}
    )
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_no_throttle_for_staff(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.staff_user, staff=True)
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.existing_org_owner.id,
            want_org_slugs=["some-other-org"],
            status=Relocation.Status.SUCCESS.value,
            step=Relocation.Step.COMPLETED.value,
            provenance=Relocation.Provenance.SAAS_TO_SAAS.value,
        )
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_success_response(self.existing_org.slug)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name

        relocation: Relocation = Relocation.objects.get(
            owner_id=self.existing_org_owner.id, status=Relocation.Status.IN_PROGRESS.value
        )
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == [self.requested_org_slug]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_good_no_throttle_for_superuser(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=True)
        Relocation.objects.create(
            creator_id=self.superuser.id,
            owner_id=self.existing_org_owner.id,
            want_org_slugs=["some-other-org"],
            status=Relocation.Status.SUCCESS.value,
            step=Relocation.Step.COMPLETED.value,
            provenance=Relocation.Provenance.SAAS_TO_SAAS.value,
        )
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        response = self.get_success_response(self.existing_org.slug)

        assert response.data["status"] == Relocation.Status.IN_PROGRESS.name
        assert response.data["step"] == Relocation.Step.UPLOADING.name
        assert response.data["provenance"] == Relocation.Provenance.SAAS_TO_SAAS.name

        relocation: Relocation = Relocation.objects.get(
            owner_id=self.existing_org_owner.id, status=Relocation.Status.IN_PROGRESS.value
        )
        assert str(relocation.uuid) == response.data["uuid"]
        assert relocation.want_org_slugs == [self.requested_org_slug]
        assert Relocation.objects.count() == relocation_count + 1
        assert RelocationFile.objects.count() == relocation_file_count

        assert uploading_start_mock.call_count == 1
        uploading_start_mock.assert_called_with(
            args=[UUID(response.data["uuid"]), EXPORTING_TEST_REGION, self.requested_org_slug]
        )

        assert analytics_record_mock.call_count == 1
        analytics_record_mock.assert_called_with(
            "relocation.forked",
            creator_id=int(response.data["creator"]["id"]),
            owner_id=int(response.data["owner"]["id"]),
            uuid=response.data["uuid"],
            from_org_slug=self.requested_org_slug,
            requesting_region_name=REQUESTING_TEST_REGION,
            replying_region_name=EXPORTING_TEST_REGION,
        )

    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_bad_without_superuser_or_staff(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.existing_org_owner, superuser=False, staff=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        self.get_error_response(self.existing_org.slug, status_code=403)

        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_bad_superuser_not_active(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        self.login_as(user=self.superuser, superuser=False)
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        self.get_error_response(self.existing_org.slug, status_code=403)

        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count

    @override_options({"relocation.enabled": True, "relocation.daily-limit.small": 1})
    @assume_test_silo_mode(SiloMode.REGION, region_name=REQUESTING_TEST_REGION)
    def test_bad_no_auth(
        self,
        uploading_start_mock: Mock,
        analytics_record_mock: Mock,
    ):
        relocation_count = Relocation.objects.count()
        relocation_file_count = RelocationFile.objects.count()

        self.get_error_response(self.existing_org.slug, status_code=401)

        assert uploading_start_mock.call_count == 0
        assert analytics_record_mock.call_count == 0
        assert Relocation.objects.count() == relocation_count
        assert RelocationFile.objects.count() == relocation_file_count
