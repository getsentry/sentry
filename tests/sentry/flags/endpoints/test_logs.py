from datetime import datetime, timedelta, timezone

from django.urls import reverse

from sentry.flags.models import PROVIDER_MAP, FlagAuditLogModel
from sentry.testutils.cases import APITestCase


class OrganizationFlagLogIndexEndpointTestCase(APITestCase):
    endpoint = "sentry-api-0-organization-flag-logs"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.id,))

    @property
    def features(self):
        return {}

    def test_get(self):
        model = FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            provider=PROVIDER_MAP["generic"],
            tags={"commit_sha": "123"},
        )
        model.save()

        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200

            result = response.json()
            assert len(result["data"]) == 1
            assert result["data"][0]["action"] == "created"
            assert "createdAt" in result["data"][0]
            assert result["data"][0]["createdBy"] == "a@b.com"
            assert result["data"][0]["createdByType"] == "email"
            assert result["data"][0]["flag"] == "hello"
            assert result["data"][0]["provider"] == "generic"
            assert result["data"][0]["tags"] == {"commit_sha": "123"}

    def test_get_no_provider(self):
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
            assert result["data"][0]["action"] == "created"
            assert "createdAt" in result["data"][0]
            assert result["data"][0]["createdBy"] == "a@b.com"
            assert result["data"][0]["createdByType"] == "email"
            assert result["data"][0]["flag"] == "hello"
            assert result["data"][0]["provider"] is None
            assert result["data"][0]["tags"] == {"commit_sha": "123"}

    def test_get_no_created_by(self):
        model = FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc),
            created_by=None,
            created_by_type=None,
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
            assert result["data"][0]["action"] == "created"
            assert "createdAt" in result["data"][0]
            assert result["data"][0]["createdBy"] is None
            assert result["data"][0]["createdByType"] is None
            assert result["data"][0]["flag"] == "hello"
            assert result["data"][0]["tags"] == {"commit_sha": "123"}

    def test_get_filter_by_flag(self):
        FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={},
        ).save()

        FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="world",
            organization_id=self.organization.id,
            tags={},
        ).save()

        with self.feature(self.features):
            response = self.client.get(self.url + "?flag=world")
            assert response.status_code == 200

            result = response.json()
            assert len(result["data"]) == 1
            assert result["data"][0]["flag"] == "world"

    def test_get_unauthorized_organization(self):
        org = self.create_organization()
        url = reverse(self.endpoint, args=(org.id,))

        with self.feature(self.features):
            response = self.client.get(url)
            assert response.status_code == 403

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

    def test_get_sort(self):
        FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc) - timedelta(days=1),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        ).save()

        FlagAuditLogModel(
            action=1,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="goodbye",
            organization_id=self.organization.id,
            tags={},
        ).save()

        with self.feature(self.features):
            response = self.client.get(self.url + "?sort=created_at")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 2
            assert response.json()["data"][0]["flag"] == "hello"
            assert response.json()["data"][1]["flag"] == "goodbye"

            response = self.client.get(self.url + "?sort=-created_at")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 2
            assert response.json()["data"][0]["flag"] == "goodbye"
            assert response.json()["data"][1]["flag"] == "hello"

            response = self.client.get(self.url + "?sort=flag")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 2
            assert response.json()["data"][0]["flag"] == "goodbye"
            assert response.json()["data"][1]["flag"] == "hello"

            # Camel case
            response = self.client.get(self.url + "?sort=createdAt")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 2
            assert response.json()["data"][0]["flag"] == "hello"
            assert response.json()["data"][1]["flag"] == "goodbye"

            response = self.client.get(self.url + "?sort=-createdAt")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 2
            assert response.json()["data"][0]["flag"] == "goodbye"
            assert response.json()["data"][1]["flag"] == "hello"

    def test_get_sort_default(self):
        FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc) - timedelta(days=1),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        ).save()

        FlagAuditLogModel(
            action=1,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={},
        ).save()

        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200
            assert len(response.json()["data"]) == 2
            assert response.json()["data"][0]["tags"].get("commit_sha") == "123"
            assert response.json()["data"][1]["tags"].get("commit_sha") is None

    def test_get_paginate(self):
        FlagAuditLogModel(
            action=0,
            created_at=datetime.now(timezone.utc) - timedelta(days=1),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            tags={"commit_sha": "123"},
        ).save()

        FlagAuditLogModel(
            action=1,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="goodbye",
            organization_id=self.organization.id,
            tags={},
        ).save()

        with self.feature(self.features):
            response = self.client.get(self.url + "?per_page=1")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 1
            assert response.json()["data"][0]["flag"] == "hello"

            response = self.client.get(self.url + "?per_page=1&cursor=1:1:0")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 1
            assert response.json()["data"][0]["flag"] == "goodbye"

            response = self.client.get(self.url + "?per_page=1&cursor=1:2:0")
            assert response.status_code == 200
            assert len(response.json()["data"]) == 0


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
        return {}

    def test_get(self):
        with self.feature(self.features):
            response = self.client.get(self.url)
            assert response.status_code == 200

            result = response.json()
            assert result["data"]["action"] == "created"
            assert "createdAt" in result["data"]
            assert result["data"]["createdBy"] == "a@b.com"
            assert result["data"]["createdByType"] == "email"
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
