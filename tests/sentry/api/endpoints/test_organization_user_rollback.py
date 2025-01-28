from rest_framework import status

from sentry.models.organizationmember import OrganizationMember
from sentry.models.rollbackorganization import RollbackOrganization
from sentry.models.rollbackuser import RollbackUser
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class OrganizationRollbackUserEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-user-rollback"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    @with_feature("organizations:sentry-rollback-2024")
    def test_simple(self):
        rollback_user = RollbackUser.objects.create(
            user_id=self.user.id,
            organization=self.organization,
            data={"animal": "sea otter"},
        )
        rollback_org = RollbackOrganization.objects.create(
            organization=self.organization,
            data={"animal": "georgie"},
        )

        response = self.get_success_response(self.organization.slug)
        assert response.status_code == status.HTTP_200_OK
        assert response.data == {
            "organization": {
                "id": self.organization.id,
                "name": self.organization.name,
                "slug": self.organization.slug,
            },
            "user": {"id": self.user.id, "name": self.user.name},
            "data": {"user": rollback_user.data, "organization": rollback_org.data},
        }

    @with_feature("organizations:sentry-rollback-2024")
    def test_user_not_in_org(self):
        newUser = self.create_user("other@example.com")
        newOrg = self.create_organization("otherorg")

        RollbackUser.objects.create(
            user_id=newUser.id,
            organization=newOrg,
            data={"animal": "sea otter"},
        )
        RollbackOrganization.objects.create(
            organization=newOrg,
            data={"animal": "georgie"},
        )

        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @with_feature("organizations:sentry-rollback-2024")
    def test_user_removed_from_org(self):
        newUser = self.create_user("other@example.com")
        OrganizationMember.objects.create(
            user_id=newUser.id,
            organization=self.organization,
        )

        RollbackUser.objects.create(
            user_id=newUser.id,
            organization=self.organization,
            data={"animal": "sea otter"},
        )
        RollbackOrganization.objects.create(
            organization=self.organization,
            data={"animal": "georgie"},
        )

        OrganizationMember.objects.filter(
            user_id=newUser.id,
            organization=self.organization,
        ).delete()

        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @with_feature("organizations:sentry-rollback-2024")
    def test_rollback_disabled(self):
        self.organization.update_option("sentry:rollback_enabled", False)
        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @with_feature("organizations:sentry-rollback-2024")
    def test_rollback_user_not_found(self):
        RollbackOrganization.objects.create(
            organization=self.organization,
            data={"animal": "georgie"},
        )
        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    @with_feature("organizations:sentry-rollback-2024")
    def test_rollback_org_not_found(self):
        RollbackUser.objects.create(
            user_id=self.user.id,
            organization=self.organization,
            data={"animal": "sea otter"},
        )

        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_rollback_feature_flag_off(self):
        response = self.get_error_response(self.organization.slug)
        assert response.status_code == status.HTTP_404_NOT_FOUND
