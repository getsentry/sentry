from sentry.testutils.cases import TestMigrations
from sentry.workflow_engine.models import DataCondition, DataConditionGroup


class MigrateDataConditionsCategoriesTest(TestMigrations):
    migrate_from = "0112_drop_redundant_error_detector_workflows"
    migrate_to = "0113_migrate_data_conditions_categories"
    app = "workflow_engine"

    def setup_initial_state(self) -> None:
        self.org = self.create_organization(name="test-org")

        # Shared DCG for simple value-remapping conditions
        self.dcg = DataConditionGroup.objects.create(organization_id=self.org.id, logic_type="any")

        # Separate DCGs for each performance logic_type variant
        self.dcg_all = DataConditionGroup.objects.create(
            organization_id=self.org.id, logic_type="all"
        )
        self.dcg_any = DataConditionGroup.objects.create(
            organization_id=self.org.id, logic_type="any"
        )
        self.dcg_any_short = DataConditionGroup.objects.create(
            organization_id=self.org.id, logic_type="any-short"
        )
        self.dcg_none = DataConditionGroup.objects.create(
            organization_id=self.org.id, logic_type="none"
        )

        self.dc_metric_issue = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 8},
            condition_result=True,
            condition_group=self.dcg,
        )
        self.dc_replay = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 5},
            condition_result=True,
            condition_group=self.dcg,
        )
        self.dc_uptime = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 7},
            condition_result=True,
            condition_group=self.dcg,
        )
        self.dc_cron = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 4},
            condition_result=True,
            condition_group=self.dcg,
        )
        self.dc_performance_all = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 2},
            condition_result=True,
            condition_group=self.dcg_all,
        )
        self.dc_performance_any = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 2},
            condition_result=True,
            condition_group=self.dcg_any,
        )
        self.dc_performance_any_short = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 2},
            condition_result=True,
            condition_group=self.dcg_any_short,
        )
        self.dc_performance_none = DataCondition.objects.create(
            type="issue_category",
            comparison={"value": 2},
            condition_result=True,
            condition_group=self.dcg_none,
        )
        self.dc_unrelated = DataCondition.objects.create(
            type="first_seen_event",
            comparison=True,
            condition_result=True,
            condition_group=self.dcg,
        )

    def test_data_conditions_migrate(self) -> None:
        # Test that GroupCategory.METRIC_ISSUE -> GroupCategory.METRIC
        dc = DataCondition.objects.get(id=self.dc_metric_issue.id)
        assert dc.type == "issue_category"
        assert dc.comparison == {"value": 11}

        # Test that GroupCategory.REPLAY -> GroupCategory.FRONTEND
        dc = DataCondition.objects.get(id=self.dc_replay.id)
        assert dc.type == "issue_category"
        assert dc.comparison == {"value": 14}

        # Test that GroupCategory.UPTIME -> issue type Uptime Monitor Detected Downtime
        dc = DataCondition.objects.get(id=self.dc_uptime.id)
        assert dc.type == "issue_type"
        assert dc.comparison == {"value": "uptime_domain_failure"}

        # Test that GroupCategory.CRON -> issue type Missed or Failed Cron Check-In
        dc = DataCondition.objects.get(id=self.dc_cron.id)
        assert dc.type == "issue_type"
        assert dc.comparison == {"value": "monitor_check_in_failure"}

        # Test that GroupCategory.PERFORMANCE with logic type 'all' -> NOT GroupCategory.ERROR
        dc = DataCondition.objects.get(id=self.dc_performance_all.id)
        assert dc.type == "issue_category"
        assert dc.comparison == {"value": 1, "include": False}
        dcg = DataConditionGroup.objects.get(id=self.dcg_all.id)
        assert dcg.logic_type == "all"
        assert DataCondition.objects.filter(condition_group=self.dcg_all).count() == 1

        # Test that GroupCategory.PERFORMANCE with logic type 'any' ->
        # GroupCategory.DB_QUERY, GroupCategory.HTTP_CLIENT, GroupCategory.FRONTEND, and GroupCategory.MOBILE
        # (4 DataConditions from 1)
        dc = DataCondition.objects.get(id=self.dc_performance_any.id)
        assert dc.type == "issue_category"
        assert dc.comparison == {"value": 12}
        new_conditions = DataCondition.objects.filter(
            condition_group=self.dcg_any,
            type="issue_category",
        ).exclude(id=self.dc_performance_any.id)
        assert new_conditions.count() == 3
        assert {c.comparison["value"] for c in new_conditions} == {13, 14, 15}
        for condition in new_conditions:
            assert "include" not in condition.comparison
        dcg = DataConditionGroup.objects.get(id=self.dcg_any.id)
        assert dcg.logic_type == "any"

        # Test that GroupCategory.PERFORMANCE with logic type 'any-short' ->
        # GroupCategory.DB_QUERY, GroupCategory.HTTP_CLIENT, GroupCategory.FRONTEND, and GroupCategory.MOBILE
        # (4 DataConditions from 1)
        dc = DataCondition.objects.get(id=self.dc_performance_any_short.id)
        assert dc.type == "issue_category"
        assert dc.comparison == {"value": 12}
        new_conditions = DataCondition.objects.filter(
            condition_group=self.dcg_any_short,
            type="issue_category",
        ).exclude(id=self.dc_performance_any_short.id)
        assert new_conditions.count() == 3
        assert {c.comparison["value"] for c in new_conditions} == {13, 14, 15}
        dcg = DataConditionGroup.objects.get(id=self.dcg_any_short.id)
        assert dcg.logic_type == "any-short"

        # Test that GroupCategory.PERFORMANCE with logic type 'none' ->
        # NOT GroupCategory.DB_QUERY, GroupCategory.HTTP_CLIENT, GroupCategory.FRONTEND, and GroupCategory.MOBILE
        # (4 NOT DataConditions from 1)
        dc = DataCondition.objects.get(id=self.dc_performance_none.id)
        assert dc.type == "issue_category"
        assert dc.comparison == {"value": 12}
        new_conditions = DataCondition.objects.filter(
            condition_group=self.dcg_none,
            type="issue_category",
        ).exclude(id=self.dc_performance_none.id)
        assert new_conditions.count() == 3
        assert {c.comparison["value"] for c in new_conditions} == {13, 14, 15}
        dcg = DataConditionGroup.objects.get(id=self.dcg_none.id)
        assert dcg.logic_type == "none"

        # Test that a type other than issue category is untouched
        dc = DataCondition.objects.get(id=self.dc_unrelated.id)
        assert dc.type == "first_seen_event"
        assert dc.comparison is True
