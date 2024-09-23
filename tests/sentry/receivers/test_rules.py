from django.forms import model_to_dict
from pytest import fixture

from sentry.incidents.models.alert_rule import (
    AlertRule,
    AlertRuleDetectionType,
    AlertRuleMonitorTypeInt,
    AlertRuleStatus,
    AlertRuleThresholdType,
)
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.receivers.rules import (
    DEFAULT_METRIC_ALERT_LABEL,
    PRIORITY_ISSUE_ALERT_DATA,
    PRIORITY_ISSUE_ALERT_LABEL,
)
from sentry.signals import project_created
from sentry.testutils.helpers.features import with_feature
from tests.sentry.auth.test_access import AccessFactoryTestCase


def _generate_metric_alert_data(organization_id: int, project: Project, team_id: int) -> dict:
    return {
        "organization": organization_id,
        "team": team_id,
        "name": DEFAULT_METRIC_ALERT_LABEL,
        "status": AlertRuleStatus.PENDING.value,
        "threshold_type": AlertRuleThresholdType.ABOVE.value,
        "resolve_threshold": None,
        "comparison_delta": None,
        "monitor_type": AlertRuleMonitorTypeInt.CONTINUOUS.value,
        "description": None,
        "detection_type": AlertRuleDetectionType.STATIC.value,
        "sensitivity": None,
        "seasonality": None,
        "projects": [project],
        "excluded_projects": [],
    }


class DefaultRulesTest(AccessFactoryTestCase):
    def setUp(self):
        super().setUp()
        # Manually create a project to avoid the initial project_created signal fire
        self.project = Project.objects.create(organization=self.organization, name="foo")

    @fixture(autouse=True)
    def _setup_flags(self):
        """
        Allow priority alerts and metric alerts by default.
        """
        with self.feature(["organizations:priority-ga-features", "organizations:incidents"]):
            yield

    def tearDown(self):
        """Ensure the default priority alert rule is always created."""
        super().tearDown()
        assert Rule.objects.count() == 1
        assert Rule.objects.filter(
            project=self.project,
            label=PRIORITY_ISSUE_ALERT_LABEL,
            data=PRIORITY_ISSUE_ALERT_DATA,
        ).exists()

    @with_feature({"organizations:default-metric-alerts-new-projects": False})
    def test_no_feature_flag(self):
        project_created.send(
            project=self.project,
            access=self.from_user(self.user, self.organization),
            default_rules=True,
            user=self.user,
            team_ids=[self.team.id],
            sender=self,
        )
        assert AlertRule.objects.count() == 0

    @with_feature("organizations:default-metric-alerts-new-projects")
    def test_no_user_or_team_passed(self):
        project_created.send(
            project=self.project,
            access=self.from_user(self.user, self.organization),
            default_rules=True,
            sender=self,
        )
        assert AlertRule.objects.count() == 0

    @with_feature("organizations:default-metric-alerts-new-projects")
    def test_send_triggers_to_user(self):
        project_created.send(
            project=self.project,
            access=self.from_user(self.user, self.organization),
            default_rules=True,
            user=self.user,
            team_ids=[self.team.id],
            sender=self,
        )

        assert AlertRule.objects.count() == 1
        metric_alert = AlertRule.objects.first()
        expected_fields = _generate_metric_alert_data(
            self.organization.id, self.project, self.team.id
        )
        # Ensure that the expected fields are a subset of the actual model fields
        assert expected_fields.items() <= model_to_dict(metric_alert).items()

        # TODO: Check triggers to ensure we're sending to the correct user

    # test sending to user invalid access

    # test sending to one team

    # test sending to one team without correct access

    # test sending to multiple teams
