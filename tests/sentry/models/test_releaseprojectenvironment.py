from datetime import timedelta
from unittest.mock import call as mock_call
from unittest.mock import patch

from django.utils import timezone

from sentry.incidents.models.alert_rule import AlertRule, AlertRuleMonitorTypeInt
from sentry.incidents.utils.types import AlertRuleActivationConditionType
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import (
    ReleaseProjectEnvironment,
    ReleaseProjectEnvironmentManager,
)
from sentry.signals import receivers_raise_on_send
from sentry.snuba.models import QuerySubscription
from sentry.testutils.cases import TestCase


class GetOrCreateTest(TestCase):
    def setUp(self):
        self.project = self.create_project(name="foo")
        self.datetime_now = timezone.now()

        self.release = Release.objects.create(
            organization_id=self.project.organization_id, version="42"
        )
        self.release.add_project(self.project)
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id, name="prod"
        )

    def test_create(self):
        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )

        assert release_project_env.project_id == self.project.id
        assert release_project_env.release_id == self.release.id
        assert release_project_env.environment_id == self.environment.id
        assert release_project_env.first_seen == self.datetime_now
        assert release_project_env.last_seen == self.datetime_now
        assert release_project_env.new_issues_count == 0

    def test_updates_last_seen(self):
        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )
        assert release_project_env.project_id == self.project.id
        assert release_project_env.release_id == self.release.id
        assert release_project_env.environment_id == self.environment.id

        datetime_next = self.datetime_now + timedelta(days=1)

        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=datetime_next,
        )
        assert release_project_env.first_seen == self.datetime_now
        assert release_project_env.last_seen == datetime_next

    def test_no_update_too_close(self):
        """
        Test ensures that ReleaseProjectEnvironment's last_seen is not updated if the next time
        it is seen is too close to the last time it was seen.
        """
        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )
        assert release_project_env.project_id == self.project.id
        assert release_project_env.release_id == self.release.id
        assert release_project_env.environment_id == self.environment.id

        datetime_next = self.datetime_now + timedelta(seconds=1)

        release_project_env = ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=datetime_next,
        )
        assert release_project_env.first_seen == self.datetime_now
        assert release_project_env.last_seen == self.datetime_now

    @receivers_raise_on_send()
    @patch.object(ReleaseProjectEnvironmentManager, "subscribe_project_to_alert_rule")
    def test_post_save_subscribes_project_to_alert_rule_if_created(
        self, mock_subscribe_project_to_alert_rule
    ):
        ReleaseProjectEnvironment.get_or_create(
            project=self.project,
            release=self.release,
            environment=self.environment,
            datetime=self.datetime_now,
        )

        assert mock_subscribe_project_to_alert_rule.call_count == 1

    @patch(
        "sentry.incidents.models.alert_rule.AlertRule.objects.conditionally_subscribe_project_to_alert_rules"
    )
    def test_subscribe_project_to_alert_rule_constructs_query(self, mock_conditionally_subscribe):
        ReleaseProjectEnvironmentManager.subscribe_project_to_alert_rule(
            project=self.project, release=self.release, environment=self.environment, trigger="test"
        )

        assert mock_conditionally_subscribe.call_count == 1
        assert mock_conditionally_subscribe.mock_calls == [
            mock_call(
                project=self.project,
                activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
                query_extra=f"release:{self.release.version} and environment:{self.environment.name}",
                origin="test",
                activator=f"release:{self.release.version} and environment:{self.environment.name}",
            )
        ]

    def test_unmocked_subscribe_project_to_alert_rule_constructs_query(self):
        # Let the logic flow through to snuba and see whether we properly construct the snuba query
        # project = self.create_project(name="foo")
        # release = Release.objects.create(organization_id=project.organization_id, version="42")
        self.create_alert_rule(
            projects=[self.project],
            monitor_type=AlertRuleMonitorTypeInt.ACTIVATED,
            activation_condition=AlertRuleActivationConditionType.DEPLOY_CREATION,
        )

        subscribe_project = AlertRule.objects.conditionally_subscribe_project_to_alert_rules
        with patch(
            "sentry.incidents.models.alert_rule.AlertRule.objects.conditionally_subscribe_project_to_alert_rules",
            wraps=subscribe_project,
        ) as wrapped_subscribe_project:
            with self.tasks():
                rpe = ReleaseProjectEnvironmentManager.subscribe_project_to_alert_rule(
                    project=self.project,
                    release=self.release,
                    environment=self.environment,
                    trigger="test",
                )

                assert rpe
                assert wrapped_subscribe_project.call_count == 1

                sub = QuerySubscription.objects.get(project=self.project)
                assert sub.subscription_id is not None
