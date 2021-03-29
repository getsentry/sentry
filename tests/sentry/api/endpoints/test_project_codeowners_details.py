from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase
from sentry.models import ProjectCodeOwners


class ProjectCodeOwnersDetailsEndpointTestCase(APITestCase):
    def setUp(self):
        self.user = self.create_user("admin@sentry.io", is_superuser=True)

        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )
        self.code_mapping = self.create_code_mapping(project=self.project)
        self.external_user = self.create_external_user(external_name="@NisanthanNanthakumar")
        self.external_team = self.create_external_team()
        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
        }
        self.codeowners = self.create_codeowners(
            project=self.project, code_mapping=self.code_mapping
        )
        self.url = reverse(
            "sentry-api-0-project-codeowners-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "codeowners_id": self.codeowners.id,
            },
        )

    def test_basic_delete(self):
        with self.feature({"organizations:import-codeowners": True}):
            response = self.client.delete(self.url)
        assert response.status_code == 204
        assert not ProjectCodeOwners.objects.filter(id=str(self.codeowners.id)).exists()

    def test_basic_update(self):
        self.create_external_team(external_name="@getsentry/frontend")
        self.create_external_team(external_name="@getsentry/docs")
        data = {
            "raw": "\n# cool stuff comment\n*.js                    @getsentry/frontend @NisanthanNanthakumar\n# good comment\n\n\n  docs/*  @getsentry/docs @getsentry/ecosystem\n\n"
        }
        with self.feature({"organizations:import-codeowners": True}):
            response = self.client.put(self.url, data)
        assert response.status_code == 200
        assert response.data["id"] == str(self.codeowners.id)
        assert response.data["raw"] == data["raw"].strip()

    def test_wrong_codeowners_id(self):
        self.url = reverse(
            "sentry-api-0-project-codeowners-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "codeowners_id": 1000,
            },
        )
        with self.feature({"organizations:import-codeowners": True}):
            response = self.client.put(self.url, self.data)
        assert response.status_code == 404
        assert response.data == {"detail": "The requested resource does not exist"}

    def test_missing_external_associations_update(self):
        data = {
            "raw": "\n# cool stuff comment\n*.js                    @getsentry/frontend @NisanthanNanthakumar\n# good comment\n\n\n  docs/*  @getsentry/docs @getsentry/ecosystem\nsrc/sentry/*       @AnotherUser\n\n"
        }
        with self.feature({"organizations:import-codeowners": True}):
            response = self.client.put(self.url, data)
        assert response.status_code == 400
        assert response.data == {
            "raw": [
                "The following usernames do not have an association in Sentry: @AnotherUser.\nThe following team names do not have an association in Sentry: @getsentry/frontend, @getsentry/docs."
            ]
        }

    def test_invalid_code_mapping_id_update(self):
        with self.feature({"organizations:import-codeowners": True}):
            response = self.client.put(self.url, {"codeMappingId": 500})
        assert response.status_code == 400
        assert response.data == {"codeMappingId": ["This code mapping does not exist."]}

    def test_no_duplicates_code_mappings(self):
        new_code_mapping = self.create_code_mapping(project=self.project, stack_root="blah")
        self.create_codeowners(project=self.project, code_mapping=new_code_mapping)
        with self.feature({"organizations:import-codeowners": True}):
            response = self.client.put(self.url, {"codeMappingId": new_code_mapping.id})
            assert response.status_code == 400
            assert response.data == {"codeMappingId": ["This code mapping is already in use."]}

    def test_codeowners_email_update(self):
        data = {"raw": f"\n# cool stuff comment\n*.js {self.user.email}\n# good comment\n\n\n"}
        with self.feature({"organizations:import-codeowners": True}):
            response = self.client.put(self.url, data)
        assert response.status_code == 200
        assert response.data["raw"] == "# cool stuff comment\n*.js admin@sentry.io\n# good comment"
