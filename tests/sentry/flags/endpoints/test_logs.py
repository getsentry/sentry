from datetime import datetime, timezone

from django.urls import reverse

from sentry.flags.models import FlagAuditLogModel
from sentry.testutils.cases import APITestCase


class OrganizationFlagLogIndexEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-logs"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.id,))

    @property
    def features(self):
        return {"organizations:feature-flag-ui": True}

    def test_get(self):
        model = FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        )
        model.save()

        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200

            result = response.json()
            assert len(result["data"]) == 1
            assert result["data"][0]["id"] == 1
            assert result["data"][0]["action"] == "created"
            assert "created_at" in result["data"][0]
            assert result["data"][0]["created_by"] == "a@b.com"
            assert result["data"][0]["created_by_type"] == "email"
            assert result["data"][0]["flag"] == "hello"
            assert result["data"][0]["tags"] == {"commit_sha": "123"}

    def test_get_unauthorized_organization(self):
        org = self.create_organization()
        url = reverse(self.endpoint, args=(org.id,))

        with self.feature(self.features):
            response = self.client.get(url)
            assert response.status_code == 403

    # def test_get_feature_disabled(self):
    #     response = self.client.get(self.url)
    #     assert response.status_code == 404

    def test_get_stats_period(self):
        model = FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        )
        model.save()

        with self.feature(self.features):
            response = self.client.get(self.url + "?statsPeriod=14d")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 1

    def test_get_start_end(self):
        model = FlagAuditLogModel(
            action=0,
            created_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        )
        model.save()

        start = datetime(2024, 1, 4, tzinfo=timezone.utc)
        end = datetime(2024, 1, 6, tzinfo=timezone.utc)

        with self.feature(self.features):
            response = self.client.get(
                self.url + f"?start={start.timestamp()}&end={end.timestamp()}"
            )
            assert response.status_code == 200
            assert len(response.json()["data"]) == 1


class OrganizationFlagLogDetailsEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-log"

    def setUp(self):
        super().setUp()
        self.flag = FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        )
        self.flag.save()

        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.id, self.flag.id))

    @property
    def features(self):
        return {"organizations:feature-flag-ui": True}

    def test_get(self):
        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200

            result = response.json()
            assert result["data"]["id"] == 4
            assert result["data"]["action"] == "created"
            assert "created_at" in result["data"]
            assert result["data"]["created_by"] == "a@b.com"
            assert result["data"]["created_by_type"] == "email"
            assert result["data"]["flag"] == "hello"
            assert result["data"]["tags"] == {"commit_sha": "123"}

    def test_get_unauthorized_organization(self):
        org = self.create_organization()
        url = reverse(self.endpoint, args=(org.id, 123))

        with self.feature(self.features):
            response = self.client.get(url)
            assert response.status_code == 403

    def test_get_no_flag(self):
        with self.feature(self.features):
            response = self.client.get(reverse(self.endpoint, args=(self.organization.id, 123)))
            assert response.status_code == 404

    # def test_get_feature_disabled(self):
    #     response = self.client.get(self.url)
    #     assert response.status_code == 404
