from sentry.testutils.cases import TestMigrations


class DeleteMalformedAnomalyConditionsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0120_replace_boolean_deescalation_comparisons"
    migrate_to = "0121_delete_malformed_anomaly_conditions"

    def setup_before_migration(self, apps):
        AlertRule = apps.get_model("sentry", "AlertRule")
        AlertRuleTrigger = apps.get_model("sentry", "AlertRuleTrigger")
        DataCondition = apps.get_model("workflow_engine", "DataCondition")
        DataConditionAlertRuleTrigger = apps.get_model(
            "workflow_engine", "DataConditionAlertRuleTrigger"
        )
        DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")
        SnubaQuery = apps.get_model("sentry", "SnubaQuery")

        snuba_query = SnubaQuery.objects.create(
            type=0,
            dataset="events",
            query="",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )
        alert_rule = AlertRule.objects_with_snapshots.create(
            organization_id=self.organization.id,
            snuba_query_id=snuba_query.id,
            name="Malformed anomaly detector",
            threshold_type=1,
            threshold_period=1,
            detection_type="dynamic",
            sensitivity="medium",
            seasonality="weekly",
        )
        alert_rule_trigger = AlertRuleTrigger.objects.create(
            alert_rule_id=alert_rule.id,
            label="critical",
            threshold_type=1,
            alert_threshold=0,
        )

        malformed_group = DataConditionGroup.objects.create(organization_id=self.organization.id)
        self.anomaly_condition = DataCondition.objects.create(
            condition_group_id=malformed_group.id,
            type="anomaly_detection",
            comparison=0.0,
            condition_result=75,
        )
        self.malformed_condition = DataCondition.objects.create(
            condition_group_id=malformed_group.id,
            type="lte",
            comparison=0,
            condition_result=0,
        )
        DataConditionAlertRuleTrigger.objects.create(
            data_condition_id=self.anomaly_condition.id,
            alert_rule_trigger_id=alert_rule_trigger.id,
        )

        orphaned_group = DataConditionGroup.objects.create(organization_id=self.organization.id)
        self.orphaned_anomaly_condition = DataCondition.objects.create(
            condition_group_id=orphaned_group.id,
            type="anomaly_detection",
            comparison=0.0,
            condition_result=75,
        )
        self.orphaned_mixed_condition = DataCondition.objects.create(
            condition_group_id=orphaned_group.id,
            type="lte",
            comparison=0,
            condition_result=0,
        )

        valid_anomaly_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id
        )
        self.valid_anomaly_condition = DataCondition.objects.create(
            condition_group_id=valid_anomaly_group.id,
            type="anomaly_detection",
            comparison={
                "sensitivity": "high",
                "seasonality": "auto",
                "threshold_type": 0,
            },
            condition_result=75,
        )
        self.valid_mixed_condition = DataCondition.objects.create(
            condition_group_id=valid_anomaly_group.id,
            type="lte",
            comparison=0,
            condition_result=0,
        )

        static_group = DataConditionGroup.objects.create(organization_id=self.organization.id)
        self.valid_static_condition = DataCondition.objects.create(
            condition_group_id=static_group.id,
            type="lte",
            comparison=0,
            condition_result=0,
        )

    def test(self):
        DataCondition = self.apps.get_model("workflow_engine", "DataCondition")

        anomaly_condition = DataCondition.objects.get(id=self.anomaly_condition.id)
        assert anomaly_condition.comparison == {
            "seasonality": "weekly",
            "sensitivity": "medium",
            "threshold_type": 1,
        }
        assert not DataCondition.objects.filter(id=self.malformed_condition.id).exists()

        orphaned_anomaly_condition = DataCondition.objects.get(
            id=self.orphaned_anomaly_condition.id
        )
        assert orphaned_anomaly_condition.comparison == 0.0
        assert DataCondition.objects.filter(id=self.orphaned_mixed_condition.id).exists()

        valid_anomaly_condition = DataCondition.objects.get(id=self.valid_anomaly_condition.id)
        assert valid_anomaly_condition.comparison == {
            "sensitivity": "high",
            "seasonality": "auto",
            "threshold_type": 0,
        }
        assert DataCondition.objects.filter(id=self.valid_mixed_condition.id).exists()
        assert DataCondition.objects.filter(id=self.valid_static_condition.id).exists()
