from django.urls import reverse

from sentry.testutils.cases import APITestCase


class OrganizationRollbackSettingsGetEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-rollback-settings"
    method = "get"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_get_settings_defaults(self):
        response = self.get_success_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "rollbackEnabled": True,
            "rollbackSharingEnabled": True,
        }

    def test_get_settings_overrides(self):
        self.organization.update_option("sentry:rollback_enabled", True)
        self.organization.update_option("sentry:rollback_sharing_enabled", False)

        response = self.get_success_response(self.organization.slug)

        assert response.status_code == 200
        assert response.data == {
            "rollbackEnabled": True,
            "rollbackSharingEnabled": False,
        }


class OrganizationRollbackSettingsPutEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-rollback-settings"
    method = "put"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

        self.url = reverse(
            self.endpoint,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def test_put_settings(self):
        response = self.client.put(
            self.url,
            {
                "rollbackEnabled": True,
                "rollbackSharingEnabled": True,
            },
        )

        assert response.status_code == 204

        assert self.organization.get_option("sentry:rollback_enabled") is True
        assert self.organization.get_option("sentry:rollback_sharing_enabled") is True

    def test_put_settings_partial(self):
        self.organization.update_option("sentry:rollback_enabled", True)
        self.organization.update_option("sentry:rollback_sharing_enabled", True)

        response = self.client.put(
            self.url,
            {
                "rollbackEnabled": True,
                "rollbackSharingEnabled": False,
            },
        )

        assert response.status_code == 204
        assert self.organization.get_option("sentry:rollback_enabled") is True
        assert self.organization.get_option("sentry:rollback_sharing_enabled") is False

    def test_error_put_settings_no_params(self):
        response = self.client.put(
            self.url,
            data={},
        )

        assert response.status_code == 400
        assert response.data == {"detail": "Must specify at least one setting"}

    def test_error_put_settings_requires_admin(self):
        self.user = self.create_user(is_superuser=False)
        self.login_as(user=self.user)

        response = self.client.put(
            self.url,
            {
                "rollbackEnabled": True,
            },
        )

        assert response.status_code == 403

    def test_error_put_settings_invalid_types(self):
        response = self.client.put(
            self.url,
            {"rollbackEnabled": "potato", "rollbackSharingEnabled": "potato"},
        )

        assert response.status_code == 400
        assert response.data == {"detail": "Settings values must be a boolean"}
