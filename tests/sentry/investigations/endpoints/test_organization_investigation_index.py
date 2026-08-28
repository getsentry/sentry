from __future__ import annotations

from unittest import mock

from django.urls import reverse

from sentry.investigations.models import (
    Investigation,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.templates.types import (
    InvestigationTemplateSpec,
    TemplateBlockSpec,
)
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationIndexTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @mock.patch("sentry.investigations.telemetry.sentry_sdk.metrics.count")
    def test_create_manual_and_list(self, metrics_count: mock.MagicMock) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "title": "Checkout follow-up",
                "projectIds": [self.project.id],
                "filters": {"environment": ["production"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["title"] == "Checkout follow-up"
        assert response.data["projectIds"] == [self.project.id]
        assert response.data["blocks"] == []
        metrics_count.assert_any_call(
            "investigations.started",
            1,
            attributes={"source_type": "manual", "template": "manual"},
        )

        response = self.client.get(self.collection_url)
        assert response.status_code == 200
        assert [item["title"] for item in response.data] == ["Checkout follow-up"]
        assert response.data[0]["blockCount"] == 0
        assert response.data[0]["isFavorited"] is False

    def test_list_includes_summary_when_projects_are_accessible(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Checkout errors",
            summary="Errors crossed alert threshold",
            summary_description="Checkout errors increased.\nReview the latest release.",
        )
        self.create_investigation_project(investigation=investigation, project=self.project)

        response = self.client.get(self.collection_url)

        assert response.status_code == 200
        listed = next(item for item in response.data if item["id"] == str(investigation.id))
        assert listed["summary"] == "Errors crossed alert threshold"
        assert listed["summaryDescription"] == (
            "Checkout errors increased.\nReview the latest release."
        )

    def test_regular_member_can_create_an_investigation(self) -> None:
        member_user = self.create_user()
        self.create_member(organization=self.organization, user=member_user, role="member")
        self.login_as(member_user)

        response = self.client.post(
            self.collection_url,
            data={"title": "Created by member"},
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["createdBy"] == str(member_user.id)

    def test_manual_creation_rejects_inaccessible_project(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)
        response = self.client.post(
            self.collection_url,
            data={"title": "No access", "projectIds": [other_project.id]},
            format="json",
        )
        assert response.status_code == 400
        assert not Investigation.objects.filter(title="No access").exists()

    def test_template_validation_is_strict_and_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": "1", "openPeriodId": "1"},
                },
                "parameters": {"unexpected": True},
            },
            format="json",
        )
        assert response.status_code == 400
        assert "parameters" in response.data
        assert Investigation.objects.count() == before

    def test_unknown_template_version_is_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 999,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": "1", "openPeriodId": "1"},
                },
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_cyclic_template_rolls_back_before_source_resolution(self) -> None:
        template = InvestigationTemplateSpec(
            key="cyclic",
            version=1,
            source_type=InvestigationSourceType.METRIC_OPEN_PERIOD,
            parameters=(),
            blocks=(
                TemplateBlockSpec(key="one", kind="text", title="One", dependencies=("two",)),
                TemplateBlockSpec(key="two", kind="text", title="Two", dependencies=("one",)),
            ),
        )
        before = Investigation.objects.count()
        with mock.patch(
            "sentry.investigations.services.investigations.get_investigation_template",
            return_value=template,
        ):
            response = self.client.post(
                self.collection_url,
                data={
                    "templateKey": "cyclic",
                    "templateVersion": 1,
                    "source": {"type": "metric_open_period", "ref": {"groupId": "1"}},
                    "parameters": {},
                },
                format="json",
            )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_template_rejects_wrong_issue_category(self) -> None:
        group = self.create_group(project=self.project)
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": str(group.id), "openPeriodId": "1"},
                },
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 404

    def test_source_lineage_lists_latest_and_keeps_historical_detail(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source": {"type": "issue", "ref": {"groupId": "123"}},
            "source_type": "issue",
            "source_ref": {"groupId": "123"},
            "source_key": "issue:123",
            "lineage_key": "issue:123",
        }
        first = self.create_investigation(
            title="First revision",
            source_revision=1,
            status=InvestigationStatus.ARCHIVED,
            **lineage,
        )
        second = self.create_investigation(
            title="Second revision", source_revision=2, status=InvestigationStatus.ACTIVE, **lineage
        )

        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(second.id)]

        first_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": first.id,
            },
        )
        assert self.client.get(first_url).status_code == 200

        second_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": second.id,
            },
        )
        assert (
            self.client.delete(
                second_url,
                data={"investigationVersion": second.version},
                format="json",
            ).status_code
            == 204
        )
        assert not Investigation.objects.filter(
            lineage_key="issue:123", status=InvestigationStatus.ACTIVE
        ).exists()

        third = self.create_investigation(
            title="Third revision", source_revision=3, status=InvestigationStatus.ACTIVE, **lineage
        )
        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(third.id)]

    def test_legacy_only_lineage_lists_only_the_latest_revision(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source_type": InvestigationSourceType.BREACHED_METRIC,
            "source_ref": {"groupId": "123", "openPeriodId": "456"},
            "source_key": "legacy-lineage",
            "status": InvestigationStatus.ARCHIVED,
        }
        self.create_investigation(title="First revision", source_revision=1, **lineage)
        second = self.create_investigation(title="Second revision", source_revision=2, **lineage)

        response = self.client.get(self.collection_url, {"status": "archived"})

        assert response.status_code == 200
        assert [item["id"] for item in response.data] == [str(second.id)]

    def test_org_auth_token_can_list_investigations(self) -> None:
        self.create_investigation(
            organization=self.organization, created_by=self.user, title="Listed"
        )
        token = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="token",
                token_hashed=hash_token(token),
                token_last_characters=token[-4:],
                scope_list=["org:read"],
                date_last_used=None,
            )
            self.client.logout()

        response = self.client.get(self.collection_url, HTTP_AUTHORIZATION=f"Bearer {token}")

        assert response.status_code == 200, response.data
        assert [item["title"] for item in response.data] == ["Listed"]
        assert response.data[0]["isFavorited"] is False
