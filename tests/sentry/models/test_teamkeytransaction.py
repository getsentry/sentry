from unittest.mock import call as mock_call
from unittest.mock import patch

from sentry.discover.models import TeamKeyTransaction, TeamKeyTransactionModelManager
from sentry.models.projectteam import ProjectTeam
from sentry.signals import receivers_raise_on_send
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import region_silo_test


@region_silo_test
class TeamKeyTransactionModelManagerTestCase(TransactionTestCase):
    def test_custom_manger(self):
        self.assertIsInstance(TeamKeyTransaction.objects, TeamKeyTransactionModelManager)

    @receivers_raise_on_send()
    def test_post_save_signal_runs_if_dynamic_sampling_is_disabled(self):
        self.project = self.create_project(name="foo")

        team = self.create_team(organization=self.organization, name="Team A")
        self.project.add_team(team)

        with patch("sentry.discover.models.schedule_invalidate_project_config") as mock_task:
            TeamKeyTransaction.objects.create(
                organization=self.organization,
                transaction="/foo",
                project_team=ProjectTeam.objects.get(project=self.project, team=team),
            )
            assert mock_task.mock_calls == []

    @receivers_raise_on_send()
    def test_post_save_signal_runs_if_dynamic_sampling_is_enabled(self):
        with Feature(
            {
                "organizations:dynamic-sampling": True,
            }
        ):
            self.project = self.create_project(name="foo")
            team = self.create_team(organization=self.organization, name="Team A")
            self.project.add_team(team)

            with patch("sentry.discover.models.schedule_invalidate_project_config") as mock_task:
                TeamKeyTransaction.objects.create(
                    organization=self.organization,
                    transaction="/foo",
                    project_team=ProjectTeam.objects.get(project=self.project, team=team),
                )
                assert mock_task.mock_calls == [
                    mock_call(project_id=self.project.id, trigger="teamkeytransaction.post_save")
                ]
