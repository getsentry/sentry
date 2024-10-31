from sentry.models.rollbackuser import RollbackUser
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
class UserRollbacksTest(APITestCase):
    endpoint = "sentry-api-0-user-rollbacks"
    method = "get"

    def setUp(self):
        super().setUp()
        self.org1 = self.create_organization(name="apple")
        self.org2 = self.create_organization(name="banana")
        self.org3 = self.create_organization(name="cherry")

        self.login_as(self.user)

    def test_simple(self):
        rollback = RollbackUser.objects.create(
            user_id=self.user.id,
            organization=self.org1,
            uuid="12345678-1234-5678-1234-567812345678",
            share_uuid="87654321-4321-8765-4321-876543210987",
        )

        response = self.get_success_response(self.user.id)
        assert response.status_code == 200

        assert len(response.data) == 1
        assert response.data[0]["organization"]["id"] == self.org1.id
        assert response.data[0]["organization"]["slug"] == self.org1.slug
        assert response.data[0]["rollback_uuid"] == rollback.uuid
        assert response.data[0]["rollback_shared_uuid"] == rollback.share_uuid

    def test_multiple_rollbacks(self):
        rollback3 = RollbackUser.objects.create(
            user_id=self.user.id,
            organization=self.org3,
            uuid="11111111-1111-1111-1111-111111111111",
            share_uuid="22222222-2222-2222-2222-222222222222",
        )
        rollback1 = RollbackUser.objects.create(
            user_id=self.user.id,
            organization=self.org1,
            uuid="33333333-3333-3333-3333-333333333333",
            share_uuid="44444444-4444-4444-4444-444444444444",
        )
        rollback2 = RollbackUser.objects.create(
            user_id=self.user.id,
            organization=self.org2,
            uuid="55555555-5555-5555-5555-555555555555",
            share_uuid="66666666-6666-6666-6666-666666666666",
        )

        response = self.get_success_response(self.user.id)
        assert response.status_code == 200

        assert len(response.data) == 3
        assert response.data[0]["organization"]["id"] == self.org1.id
        assert response.data[0]["rollback_uuid"] == rollback1.uuid
        assert response.data[1]["organization"]["id"] == self.org2.id
        assert response.data[1]["rollback_uuid"] == rollback2.uuid
        assert response.data[2]["organization"]["id"] == self.org3.id
        assert response.data[2]["rollback_uuid"] == rollback3.uuid

    def test_missing_permission(self):
        self.user = self.create_user()
        # Don't log in
        response = self.get_response(self.user.id)
        assert response.status_code == 403
