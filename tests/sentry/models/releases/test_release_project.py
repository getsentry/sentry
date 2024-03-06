from unittest.mock import call as mock_call
from unittest.mock import patch

from django.utils import timezone

from sentry.dynamic_sampling import ProjectBoostedReleases
from sentry.incidents.models.alert_rule import AlertRule, AlertRuleMonitorType
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject, ReleaseProjectModelManager
from sentry.signals import receivers_raise_on_send
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ReleaseProjectManagerTestCase(TransactionTestCase):
    def test_custom_manager(self):
        self.assertIsInstance(ReleaseProject.objects, ReleaseProjectModelManager)

    @receivers_raise_on_send()
    @patch.object(ReleaseProjectModelManager, "_subscribe_project_to_alert_rule")
    def test_post_save_signal_runs_if_dynamic_sampling_is_disabled(self, _):
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="42")

        with patch(
            "sentry.models.releases.release_project.schedule_invalidate_project_config"
        ) as mock_task:
            release.add_project(project)
            assert mock_task.mock_calls == []

    @receivers_raise_on_send()
    @patch.object(ReleaseProjectModelManager, "_subscribe_project_to_alert_rule")
    def test_post_save_signal_runs_if_dynamic_sampling_is_enabled_and_latest_release_rule_does_not_exist(
        self,
        _,
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
    @patch.object(ReleaseProjectModelManager, "_subscribe_project_to_alert_rule")
    def test_post_save_signal_runs_if_dynamic_sampling_is_enabled_and_latest_release_rule_exists(
        self,
        _,
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

    @receivers_raise_on_send()
    @patch("sentry.models.releases.release_project.schedule_invalidate_project_config")
    @patch.object(ReleaseProjectModelManager, "_subscribe_project_to_alert_rule")
    def test_post_save_subscribes_project_to_alert_rule_if_created(
        self, mock_subscribe_project_to_alert_rule, _
    ):
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="42")

        release.add_project(project)

        assert mock_subscribe_project_to_alert_rule.call_count == 1
        # models.signals.post_save.send(instance=inst, sender=type(inst), created=False)

    @patch(
        "sentry.incidents.models.alert_rule.AlertRule.objects.conditionally_subscribe_project_to_alert_rules"
    )
    def test_subscribe_project_to_alert_rule_constructs_query(self, mock_conditionally_subscribe):
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="42")
        now = timezone.now()
        with freeze_time(now):
            ReleaseProjectModelManager._subscribe_project_to_alert_rule(
                project=project, release=release, trigger="test"
            )

            assert mock_conditionally_subscribe.call_count == 1
            assert mock_conditionally_subscribe.mock_calls == [
                mock_call(
                    project=project,
                    activation_condition=AlertRuleActivationConditionType.RELEASE_CREATION,
                    query_extra=f"release:42 AND event.timestamp:>{now.isoformat()}",
                    trigger="test",
                )
            ]

    def test_unmocked_subscribe_project_to_alert_rule_constructs_query(self):
        # Let the logic flow through to snuba and see whether we properly construct the snuba query
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="42")
        alert_rule = self.create_alert_rule(
            projects=[project], monitor_type=AlertRuleMonitorType.ACTIVATED
        )
        self.create_alert_rule_activation_condition(alert_rule=alert_rule)

        subscribe_project = AlertRule.objects.conditionally_subscribe_project_to_alert_rules
        with patch(
            "sentry.incidents.models.alert_rule.AlertRule.objects.conditionally_subscribe_project_to_alert_rules",
            wraps=subscribe_project,
        ) as wrapped_subscribe_project:
            with self.tasks():
                _, created = release.add_project(project)

                assert created
                assert wrapped_subscribe_project.call_count == 1

                queryset = QuerySubscription.objects.filter(project=project)
                assert queryset.exists()

                sub = queryset.first()
                assert sub.subscription_id is not None
