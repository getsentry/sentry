import sys

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework.response import Response

from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.testutils.cases import APITestCase, OutcomesSnubaTest
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.features import with_feature
from sentry.utils.outcomes import Outcome
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


@freeze_time(before_now(days=1).replace(hour=1, minute=10))
class OrganizationStatsTest(APITestCase, OutcomesSnubaTest):
    def test_rejects_unsupported_group(self) -> None:
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-organization-stats", args=[self.organization.slug])

        response = self.client.get(url, {"group": "category"})

        assert response.status_code == 400
        assert response.data["detail"] == (
            "group=category is not supported. Use group=organization for organization-wide "
            "statistics or group=project for statistics separated by project."
        )

    def test_rejects_unsupported_stat_for_group(self) -> None:
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-organization-stats", args=[self.organization.slug])

        response = self.client.get(url, {"stat": "generated"})

        assert response.status_code == 400
        assert response.data["detail"] == (
            "stat=generated is not supported with group=organization. Use stat=received, "
            "stat=rejected, or stat=blacklisted. stat=generated is only supported with "
            "group=project."
        )

    def test_simple(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org)
        project_key = self.create_project_key(project=project)
        self.store_outcomes(
            {
                "org_id": org.id,
                "timestamp": before_now(minutes=1),
                "project_id": project.id,
                "key_id": project_key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            3,
        )

        url = reverse("sentry-api-0-organization-stats", args=[org.slug])
        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        for point in response.data[:-1]:
            assert point[1] == 0
        assert len(response.data) == 24

    def test_resolution(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org)
        project_key = self.create_project_key(project=project)
        self.store_outcomes(
            {
                "org_id": org.id,
                "timestamp": before_now(hours=1),
                "project_id": project.id,
                "key_id": project_key.id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            3,
        )

        url = reverse("sentry-api-0-organization-stats", args=[org.slug])
        response = self.client.get(f"{url}?resolution=1d")

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 3, response.data
        assert len(response.data) == 1

    def test_resolution_invalid(self) -> None:
        self.login_as(user=self.user)
        url = reverse("sentry-api-0-organization-stats", args=[self.organization.slug])
        response = self.client.get(f"{url}?resolution=lol-nope")

        assert response.status_code == 400, response.content

    def test_id_filtering(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )

        url = reverse("sentry-api-0-organization-stats", args=[org.slug])

        response = self.client.get(url, {"id": str(project.id), "group": "project"})

        assert response.status_code == 200, response.content
        assert project.id in response.data

        response = self.client.get(url, {"id": str(sys.maxsize), "group": "project"})

        assert project.id not in response.data

    def test_project_id_only(self) -> None:
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user)
        project = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )
        project2 = self.create_project(
            teams=[self.create_team(organization=org, members=[self.user])]
        )

        response = self.client.get(
            reverse("sentry-api-0-organization-stats", args=[org.slug]),
            {"projectID": str(project.id), "group": "project"},
        )

        assert response.status_code == 200, response.content
        assert project.id in response.data
        assert project2.id not in response.data


@freeze_time(before_now(days=1).replace(hour=1, minute=10))
@override_settings(SEER_API_SHARED_SECRET="service-account-secret")
@with_feature("organizations:service-accounts")
class OrganizationStatsServiceAccountTest(APITestCase, OutcomesSnubaTest):
    endpoint = "sentry-api-0-organization-stats"

    def setUp(self) -> None:
        super().setUp()
        self.linked = self.create_project(organization=self.organization, teams=[self.team])
        self.unlinked = self.create_project(organization=self.organization, teams=[self.team])
        self.store_accepted_errors(self.linked, 2)
        self.store_accepted_errors(self.unlinked, 3)
        self.service_account = self.create_service_account(
            organization=self.organization, scope_list=["org:read"], project_ids=[self.linked.id]
        )

    def store_accepted_errors(self, project: Project, quantity: int) -> None:
        self.store_outcomes(
            {
                "org_id": self.organization.id,
                "timestamp": before_now(minutes=1),
                "project_id": project.id,
                "key_id": self.create_project_key(project=project).id,
                "outcome": Outcome.ACCEPTED,
                "reason": "none",
                "category": DataCategory.ERROR,
                "quantity": 1,
            },
            quantity,
        )

    def get_as_service_account(self, params: dict[str, str]) -> Response:
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=self.service_account.id),
                organization_id=self.organization.id,
            ),
            key="service-account-secret",
        )
        return self.client.get(
            reverse(self.endpoint, args=[self.organization.slug]),
            params,
            HTTP_X_VIEWER_CONTEXT=viewer_context,
        )

    @pytest.mark.xfail(
        strict=True,
        reason="Known gap: group=organization returns org-wide totals, including unlinked projects.",
    )
    def test_organization_totals_count_only_linked_projects(self) -> None:
        response = self.get_as_service_account({"group": "organization"})

        assert response.status_code == 200, response.content
        assert response.data[-1][1] == 2

    @pytest.mark.xfail(
        strict=True,
        reason="Known gap: group=project picks projects by the caller's teams, and a service account has none.",
    )
    def test_project_group_returns_only_linked_projects(self) -> None:
        response = self.get_as_service_account({"group": "project"})

        assert response.status_code == 200, response.content
        assert set(response.data) == {self.linked.id}

    def test_project_group_never_returns_unlinked_projects(self) -> None:
        response = self.get_as_service_account(
            {"group": "project", "projectID": str(self.unlinked.id)},
        )

        assert response.status_code == 200, response.content
        assert self.unlinked.id not in response.data
