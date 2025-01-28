from unittest.mock import call as mock_call
from unittest.mock import patch

from sentry.dynamic_sampling import ProjectBoostedReleases
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject, ReleaseProjectModelManager
from sentry.signals import receivers_raise_on_send
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers import Feature


class ReleaseProjectManagerTestCase(TransactionTestCase):
    def test_custom_manager(self):
        self.assertIsInstance(ReleaseProject.objects, ReleaseProjectModelManager)

    @receivers_raise_on_send()
    def test_post_save_signal_runs_if_dynamic_sampling_is_disabled(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="42")

        with patch(
            "sentry.models.releases.release_project.schedule_invalidate_project_config"
        ) as mock_task:
            release.add_project(project)
            assert mock_task.mock_calls == []

    @receivers_raise_on_send()
    def test_post_save_signal_runs_if_dynamic_sampling_is_enabled_and_latest_release_rule_does_not_exist(
        self,
    ):
        with Feature(
            {
                "organizations:dynamic-sampling": True,
            }
        ):
            project = self.create_project(name="foo")
            release = Release.objects.create(organization_id=project.organization_id, version="42")

            with patch(
                "sentry.models.releases.release_project.schedule_invalidate_project_config"
            ) as mock_task:
                release.add_project(project)
                assert mock_task.mock_calls == []

    @receivers_raise_on_send()
    def test_post_save_signal_runs_if_dynamic_sampling_is_enabled_and_latest_release_rule_exists(
        self,
    ):
        with Feature(
            {
                "organizations:dynamic-sampling": True,
            }
        ):
            project = self.create_project(name="foo")
            release = Release.objects.create(organization_id=project.organization_id, version="42")
            project_boosted_releases = ProjectBoostedReleases(project.id)
            # We store a boosted release for this project.
            project_boosted_releases.add_boosted_release(release.id, None)
            assert project_boosted_releases.has_boosted_releases

            with patch(
                "sentry.models.releases.release_project.schedule_invalidate_project_config"
            ) as mock_task:
                release.add_project(project)
                assert mock_task.mock_calls == [
                    mock_call(project_id=project.id, trigger="releaseproject.post_save")
                ]
