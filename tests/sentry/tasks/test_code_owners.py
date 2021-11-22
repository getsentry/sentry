from sentry.models import ExternalActor
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.tasks.code_owners import update_code_owners_schema
from sentry.testutils import TestCase


class CodeOwnersTest(TestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )
        self.code_mapping = self.create_code_mapping(
            project=self.project,
        )

        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
        }

        self.code_owners = self.create_codeowners(
            self.project, self.code_mapping, raw=self.data["raw"]
        )

    def test_simple(self):
        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            # new external team mapping
            self.external_team = self.create_external_team(integration=self.integration)
            update_code_owners_schema(organization=self.organization, integration=self.integration)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)

        assert code_owners.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "docs/*"},
                    "owners": [
                        {"type": "team", "identifier": "tiger-team"},
                    ],
                }
            ],
        }

        with self.tasks() and self.feature({"organizations:integrations-codeowners": True}):
            # delete external team mapping
            ExternalActor.objects.get(id=self.external_team.id).delete()
            update_code_owners_schema(organization=self.organization, integration=self.integration)

        code_owners = ProjectCodeOwners.objects.get(id=self.code_owners.id)

        assert code_owners.schema == {"$version": 1, "rules": []}
