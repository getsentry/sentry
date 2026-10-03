"""Runtime evidence for nullable validated_data reads. Exploratory, not committed."""

from __future__ import annotations

from django.urls import reverse

from sentry.models.deploy import Deploy
from sentry.models.release import Release
from sentry.models.team import Team
from sentry.testutils.cases import APITestCase


class DeployNullDateFinishedTest(APITestCase):
    def test_post_with_null_date_finished(self) -> None:
        release = Release.objects.create(organization_id=self.organization.id, version="1.0")
        release.add_project(self.project)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={"organization_id_or_slug": self.organization.slug, "version": release.version},
        )
        for label, body in (
            ("omitted", {"environment": "prod"}),
            ("null", {"environment": "prod", "dateFinished": None}),
        ):
            try:
                response = self.client.post(url, data=body, format="json")
                status, detail = response.status_code, str(getattr(response, "data", ""))[:200]
            except Exception as exc:
                status, detail = "raised", f"{type(exc).__name__}: {str(exc)[:200]}"
            print(f"\nDEPLOY dateFinished {label}: status={status} detail={detail}")  # noqa: S002, T201
        print(f"DEPLOY rows created: {Deploy.objects.filter(release_id=release.id).count()}")  # noqa: S002, T201


class TeamNullSlugTest(APITestCase):
    def test_post_with_name_only_and_null_slug(self) -> None:
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-teams",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )
        for label, body in (
            ("name only", {"name": "Alpha Team"}),
            ("slug null", {"name": "Beta Team", "slug": None}),
        ):
            try:
                response = self.client.post(url, data=body, format="json")
                status, detail = response.status_code, str(getattr(response, "data", ""))[:160]
            except Exception as exc:
                status, detail = "raised", f"{type(exc).__name__}: {str(exc)[:160]}"
            print(f"\nTEAM {label}: status={status} detail={detail}")  # noqa: S002, T201
        slugs = sorted(
            Team.objects.filter(organization=self.organization).values_list("slug", flat=True)
        )
        print(f"TEAM slugs: {slugs}")  # noqa: S002, T201
