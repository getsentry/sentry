from __future__ import annotations

from django.urls import reverse

from sentry.investigations.models import InvestigationBlock
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationBlockIndexEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Block tests",
        )

    def blocks_url(self) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-blocks",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

    def test_create_block(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": 1,
                "kind": "query",
                "content": "find slow transactions",
                "generationPrompt": "Generate the query",
                "display": {"type": "bar", "xAxis": "release", "yAxes": ["count"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["content"] == "find slow transactions"
        assert response.data["generationPrompt"] == "Generate the query"
        assert response.data["generatedContent"] == ""

        block = InvestigationBlock.objects.get(id=response.data["id"])
        assert block.investigation_id == self.investigation.id

        self.investigation.refresh_from_db()
        assert self.investigation.version == 2

    def test_display_validation(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {"type": "line", "xAxis": "time", "yAxes": []},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "text",
                "display": {"type": "table"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "content": "Show error volume",
                "display": {
                    "version": 1,
                    "type": "table",
                    "defaultView": "chart",
                    "queryCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data

    def test_versioned_display_rejects_invalid_field_types(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {"version": 1.0, "type": "table"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "text",
                "display": {"version": True, "type": "markdown"},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {"version": 1, "type": []},
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "table",
                    "stacked": "yes",
                },
            },
            format="json",
        )
        assert response.status_code == 400

        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "query",
                "display": {
                    "version": 1,
                    "type": "table",
                    "topN": True,
                },
            },
            format="json",
        )
        assert response.status_code == 400

    def test_text_display_accepts_persisted_prompt_collapse(self) -> None:
        response = self.client.post(
            self.blocks_url(),
            data={
                "investigationVersion": self.investigation.version,
                "kind": "text",
                "generationPrompt": "Summarize the context",
                "display": {
                    "version": 1,
                    "type": "markdown",
                    "promptCollapsed": True,
                },
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["display"]["promptCollapsed"] is True

    def test_sentry_app_cannot_create_block(self) -> None:
        sentry_app_user = self.create_user(is_sentry_app=True)
        self.create_member(
            organization=self.organization,
            user=sentry_app_user,
            role="member",
        )
        self.login_as(sentry_app_user)

        response = self.client.post(
            self.blocks_url(),
            data={"investigationVersion": self.investigation.version, "kind": "text"},
            format="json",
        )
        assert response.status_code == 403
        assert not InvestigationBlock.objects.filter(investigation=self.investigation).exists()
