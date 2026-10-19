from datetime import datetime, timezone

from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.flags.models import PROVIDER_MAP, FlagAuditLogModel


class OrganizationFlagLogsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        self.flag_log = FlagAuditLogModel.objects.create(
            action=2,
            created_at=datetime.now(timezone.utc),
            created_by="a@b.com",
            created_by_type=0,
            flag="hello",
            organization_id=self.organization.id,
            provider=PROVIDER_MAP["launchdarkly"],
            tags={"environment": "production"},
        )
        self.login_as(user=self.user)

    def test_list(self) -> None:
        url = reverse(
            "sentry-api-0-organization-flag-logs",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.get(url)
        request = RequestFactory().get(url)

        assert response.status_code == 200
        assert len(response.data["data"]) == 1
        self.validate_schema(request, response)

    def test_list_no_provider(self) -> None:
        self.flag_log.provider = None
        self.flag_log.created_by = None
        self.flag_log.created_by_type = None
        self.flag_log.save()

        url = reverse(
            "sentry-api-0-organization-flag-logs",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        response = self.client.get(url)
        request = RequestFactory().get(url)

        assert response.status_code == 200
        self.validate_schema(request, response)

    def test_get(self) -> None:
        url = reverse(
            "sentry-api-0-organization-flag-log",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "flag_log_id": self.flag_log.id,
            },
        )
        response = self.client.get(url)
        request = RequestFactory().get(url)

        assert response.status_code == 200
        self.validate_schema(request, response)
