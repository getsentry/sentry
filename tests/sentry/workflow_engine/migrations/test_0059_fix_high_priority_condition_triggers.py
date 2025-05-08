from sentry.testutils.cases import TestMigrations


# @pytest.mark.skip("Timeout failures—skipping these tests, which pass, to unblock migration.")
class TestMigrateRemainingIssueAlerts(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0058_add_inc_identifier_incidentgroupopenperiod"
    migrate_to = "0059_fix_high_priority_condition_triggers"

    def setup_initial_state(self):
        self.when_dcg = self.create_data_condition_group()
        self.workflow = self.create_workflow(when_condition_group=self.when_dcg)
        self.if_dcg = self.create_data_condition_group()
        self.workflow_dcg = self.create_workflow_data_condition_group(
            workflow=self.workflow, condition_group=self.if_dcg
        )
        self.high_priority_conditions = [
            self.create_data_condition(
                condition_group=self.if_dcg,
                type="existing_high_priority_issue",
                comparison=True,
                condition_result=True,
            ),
            self.create_data_condition(
                condition_group=self.if_dcg,
                type="new_high_priority_issue",
                comparison=True,
                condition_result=True,
            ),
        ]
        self.correct_filters = [
            self.create_data_condition(
                condition_group=self.if_dcg,
                type="issue_category",
                comparison={"value": 1},
                condition_result=True,
            ),
            self.create_data_condition(
                condition_group=self.if_dcg, type="issue_occurrences", comparison={"value": 1}
            ),
        ]

        # correct workflow
        self.when_dcg_2 = self.create_data_condition_group()
        self.workflow_2 = self.create_workflow(when_condition_group=self.when_dcg_2)
        self.if_dcg_2 = self.create_data_condition_group()
        self.workflow_dcg_2 = self.create_workflow_data_condition_group(
            workflow=self.workflow_2, condition_group=self.if_dcg_2
        )
        self.high_priority_conditions_2 = [
            self.create_data_condition(
                condition_group=self.when_dcg_2,
                type="existing_high_priority_issue",
                comparison=True,
                condition_result=True,
            ),
            self.create_data_condition(
                condition_group=self.when_dcg_2,
                type="new_high_priority_issue",
                comparison=True,
                condition_result=True,
            ),
        ]

    def test(self):
        for condition in self.high_priority_conditions:
            condition.refresh_from_db()
            assert condition.condition_group_id == self.when_dcg.id

        for filter in self.correct_filters:
            filter.refresh_from_db()
            assert filter.condition_group_id == self.if_dcg.id

        for condition in self.high_priority_conditions_2:
            condition.refresh_from_db()
            assert condition.condition_group_id == self.when_dcg_2.id
