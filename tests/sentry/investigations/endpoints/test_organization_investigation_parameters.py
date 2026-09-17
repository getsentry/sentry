from __future__ import annotations

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class InvestigationParametersEndpointTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Parameter tests",
        )

    def test_parameter_update_marks_transitive_dependents_stale(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        first = self.create_investigation_block(
            investigation=self.investigation, position=0, kind="query"
        )
        second = self.create_investigation_block(
            investigation=self.investigation, position=1, kind="text"
        )
        unrelated = self.create_investigation_block(
            investigation=self.investigation, position=2, kind="text"
        )
        self.create_investigation_block_parameter(block=first, parameter=parameter)
        self.create_investigation_block_dependency(block=second, depends_on=first)
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "values": {"environment": "production"},
            },
            format="json",
        )
        assert response.status_code == 200, response.data
        parameter.refresh_from_db()
        first.refresh_from_db()
        second.refresh_from_db()
        unrelated.refresh_from_db()
        self.investigation.refresh_from_db()
        assert parameter.saved_value == "production"
        assert parameter.version == 2
        assert self.investigation.version == 2
        assert first.stale_at is not None
        assert second.stale_at is not None
        assert unrelated.stale_at is None

    def test_project_parameter_update_accepts_accessible_project(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="project",
            label="Project",
            type="project",
            position=0,
        )
        project = self.create_project(organization=self.organization)
        filtered_project = self.create_project(organization=self.organization)
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.put(
            f"{url}?project={filtered_project.id}",
            data={
                "investigationVersion": self.investigation.version,
                "values": {"project": project.id},
            },
            format="json",
        )

        assert response.status_code == 200, response.data
        parameter.refresh_from_db()
        self.investigation.refresh_from_db()
        assert parameter.saved_value == project.id
        assert parameter.version == 2
        assert self.investigation.version == 2

    def test_parameter_update_allows_optional_null_and_rejects_required_null(self) -> None:
        optional = self.create_investigation_parameter(
            investigation=self.investigation,
            key="optional",
            label="Optional",
            type="string",
            position=0,
            saved_value="production",
        )
        required = self.create_investigation_parameter(
            investigation=self.investigation,
            key="required",
            label="Required",
            type="string",
            position=1,
            required=True,
            saved_value="production",
        )
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.put(
            url,
            data={"investigationVersion": 1, "values": {"optional": None}},
            format="json",
        )
        assert response.status_code == 200, response.data
        optional.refresh_from_db()
        self.investigation.refresh_from_db()
        assert optional.saved_value is None
        assert optional.version == 2
        assert self.investigation.version == 2

        response = self.client.put(
            url,
            data={"investigationVersion": 2, "values": {"required": None}},
            format="json",
        )
        assert response.status_code == 400
        required.refresh_from_db()
        self.investigation.refresh_from_db()
        assert required.saved_value == "production"
        assert required.version == 1
        assert self.investigation.version == 2

    def test_project_parameter_update_rejects_inaccessible_project(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="project",
            label="Project",
            type="project",
            position=0,
        )
        foreign_project = self.create_project(organization=self.create_organization())
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )
        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "values": {"project": foreign_project.id},
            },
            format="json",
        )
        assert response.status_code == 400
        parameter.refresh_from_db()
        assert parameter.saved_value is None
        assert parameter.version == 1
        self.investigation.refresh_from_db()
        assert self.investigation.version == 1

    def test_sentry_app_cannot_update_parameters(self) -> None:
        parameter = self.create_investigation_parameter(
            investigation=self.investigation,
            key="environment",
            label="Environment",
            type="string",
            position=0,
        )
        sentry_app_user = self.create_user(is_sentry_app=True)
        self.create_member(
            organization=self.organization,
            user=sentry_app_user,
            role="member",
        )
        self.login_as(sentry_app_user)
        url = reverse(
            "sentry-api-0-organization-investigation-parameters",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": self.investigation.id,
            },
        )

        response = self.client.put(
            url,
            data={
                "investigationVersion": self.investigation.version,
                "values": {"environment": "production"},
            },
            format="json",
        )

        assert response.status_code == 403
        parameter.refresh_from_db()
        assert parameter.saved_value is None
