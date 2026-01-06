from unittest.mock import patch

from sentry.issues.ownership.grammar import Matcher, Owner, Rule, dump_schema
from sentry.models.projectcodeowners import ProjectCodeOwners
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class ProjectCodeOwnersTestCase(TestCase):
    def tearDown(self) -> None:
        cache.delete(ProjectCodeOwners.get_cache_key(self.project.id))

        super().tearDown()

    def setUp(self) -> None:
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

        self.external_team = self.create_external_team(integration=self.integration)
        self.external_user = self.create_external_user(
            self.user,
            self.organization,
            integration=self.integration,
            external_name="@NisanthanNanthakumar",
        )

        self.data = {
            "raw": "docs/*    @NisanthanNanthakumar   @getsentry/ecosystem\n",
        }

    def test_merge_codeowners(self) -> None:
        self.code_mapping_2 = self.create_code_mapping(
            project=self.project,
            stack_root="stack/root/",
        )

        code_owners_1_rule = Rule(
            Matcher("codeowners", "docs/*"),
            [Owner("user", self.user.email), Owner("team", self.team.slug)],
        )
        code_owners_2_rule = Rule(
            Matcher("codeowners", "stack/root/docs/*"),
            [Owner("user", self.user.email), Owner("team", self.team.slug)],
        )

        self.code_owners = self.create_codeowners(
            self.project,
            self.code_mapping,
            raw=self.data["raw"],
            schema=dump_schema([code_owners_1_rule]),
        )

        self.code_owners_2 = self.create_codeowners(
            self.project,
            self.code_mapping_2,
            raw=self.data["raw"],
            schema=dump_schema([code_owners_2_rule]),
        )

        code_owners = ProjectCodeOwners.objects.filter(project=self.project)
        merged = ProjectCodeOwners.merge_code_owners_list(code_owners_list=code_owners)
        assert merged is not None

        assert merged.schema == {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "codeowners", "pattern": "docs/*"},
                    "owners": [
                        {"type": "user", "identifier": "admin@localhost"},
                        {"type": "team", "identifier": "tiger-team"},
                    ],
                },
                {
                    "matcher": {"type": "codeowners", "pattern": "stack/root/docs/*"},
                    "owners": [
                        {"type": "user", "identifier": "admin@localhost"},
                        {"type": "team", "identifier": "tiger-team"},
                    ],
                },
            ],
        }

    @patch("sentry.tasks.codeowners.invalidate_project_issue_owners_cache")
    def test_post_save_triggers_async_cache_invalidation(self, mock_invalidate_task) -> None:
        self.create_codeowners(
            self.project,
            self.code_mapping,
            raw=self.data["raw"],
        )

        mock_invalidate_task.delay.assert_called_once_with(self.project.id)

    @patch("sentry.tasks.codeowners.invalidate_project_issue_owners_cache")
    def test_post_delete_triggers_async_cache_invalidation(self, mock_invalidate_task) -> None:
        code_owners = self.create_codeowners(
            self.project,
            self.code_mapping,
            raw=self.data["raw"],
        )
        mock_invalidate_task.reset_mock()

        code_owners.delete()

        mock_invalidate_task.delay.assert_called_once_with(self.project.id)
