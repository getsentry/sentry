from django.urls import reverse

from sentry.testutils.cases import APITestCase


class OrganizationPreprodArtifactApproveTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)
        self.org.flags.allow_joinleave = False
        self.org.save()

        self.team_a = self.create_team(organization=self.org, slug="team-a")
        self.team_b = self.create_team(organization=self.org, slug="team-b")

        self.project_b = self.create_project(organization=self.org, teams=[self.team_b])
        self.artifact = self.create_preprod_artifact(project=self.project_b)

        self.outsider = self.create_user(is_superuser=False)
        self.create_member(
            user=self.outsider, organization=self.org, role="member", teams=[self.team_a]
        )

    def _approve_url(self, artifact_id):
        return reverse(
            "sentry-api-0-organization-preprod-artifact-approve",
            args=[self.org.slug, artifact_id],
        )

    def test_approve_returns_404_for_member_without_project_access(
        self,
    ) -> None:
        self.login_as(user=self.outsider)

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "size"},
            format="json",
        )

        assert response.status_code == 404
