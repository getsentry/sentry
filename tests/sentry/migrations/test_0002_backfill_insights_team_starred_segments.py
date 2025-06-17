from sentry.discover.models import TeamKeyTransaction
from sentry.insights.models import InsightsStarredSegment
from sentry.models.organization import Organization
from sentry.models.projectteam import ProjectTeam
from sentry.models.team import Team
from sentry.testutils.cases import TestMigrations


class BackfillUserStarredSegmentsTest(TestMigrations):
    migrate_from = "0001_squashed_0001_add_starred_transactions_model"
    migrate_to = "0002_backfill_team_starred"
    app = "insights"

    def setup_before_migration(self, apps):
        self.organization: Organization = self.create_organization(name="test", slug="test")
        self.project = self.create_project(organization=self.organization)
        self.user = self.create_user()
        self.environment = self.create_environment(
            organization=self.organization, project=self.project
        )
        self.team: Team = self.create_team(
            organization=self.organization, members=[self.user, None]
        )

        self.transaction_name = "my-transaction"

        self.project_team = ProjectTeam.objects.create(
            project_id=self.project.id, team_id=self.team.id
        )

        self.team_key_transaction = TeamKeyTransaction.objects.create(
            organization=self.organization,
            project_team=self.project_team,
            transaction=self.transaction_name,
        )

    def test_migrates_single_entry(self):
        self.team_key_transaction.refresh_from_db()

        starred_segment_results = InsightsStarredSegment.objects.filter(
            organization_id=self.organization.id,
            project_id=self.project.id,
            user_id=self.user.id,
        )
        assert len(starred_segment_results) == 1

        first_starred_segment = starred_segment_results[0]
        assert first_starred_segment.segment_name == "my-transaction"
        assert first_starred_segment.user_id == self.user.id
        assert first_starred_segment.project.id == self.project.id
