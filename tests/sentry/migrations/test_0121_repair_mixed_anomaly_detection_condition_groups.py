from sentry.testutils.cases import TestMigrations


class RepairMixedAnomalyDetectionConditionGroupsTest(TestMigrations):
    app = "workflow_engine"
    migrate_from = "0120_replace_boolean_deescalation_comparisons"  # pyright: ignore[reportAssignmentType]
    migrate_to = "0121_repair_mixed_anomaly_detection_condition_groups"  # pyright: ignore[reportAssignmentType]

    def setup_before_migration(self, apps):
        DataCondition = apps.get_model("workflow_engine", "DataCondition")
        DataConditionGroup = apps.get_model("workflow_engine", "DataConditionGroup")

        mixed_group = DataConditionGroup.objects.create(organization_id=self.organization.id)
        self.mixed_anomaly_id = DataCondition.objects.create(
            condition_group_id=mixed_group.id,
            type="anomaly_detection",
            comparison=0.0,
            condition_result=2,
        ).id
        self.mixed_static_ids = [
            DataCondition.objects.create(
                condition_group_id=mixed_group.id,
                type=condition_type,
                comparison=comparison,
                condition_result=condition_result,
            ).id
            for condition_type, comparison, condition_result in (
                ("lte", 0.0, 0),
                ("gt", 100.0, 2),
            )
        ]

        anomalies_only_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id
        )
        self.anomalies_only_ids = [
            DataCondition.objects.create(
                condition_group_id=anomalies_only_group.id,
                type="anomaly_detection",
                comparison={
                    "seasonality": "weekly",
                    "sensitivity": "high",
                    "threshold_type": 0,
                },
                condition_result=condition_result,
            ).id
            for condition_result in (1, 2)
        ]

        single_anomaly_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id
        )
        self.single_anomaly_id = DataCondition.objects.create(
            condition_group_id=single_anomaly_group.id,
            type="anomaly_detection",
            comparison={
                "seasonality": "daily",
                "sensitivity": "medium",
                "threshold_type": 1,
            },
            condition_result=2,
        ).id

        static_group = DataConditionGroup.objects.create(organization_id=self.organization.id)
        self.static_condition_ids = [
            DataCondition.objects.create(
                condition_group_id=static_group.id,
                type=condition_type,
                comparison=comparison,
                condition_result=condition_result,
            ).id
            for condition_type, comparison, condition_result in (
                ("gt", 10.0, 2),
                ("lte", 10.0, 0),
            )
        ]

    def test_repair_mixed_anomaly_detection_condition_groups(self):
        DataCondition = self.apps.get_model("workflow_engine", "DataCondition")
        default_comparison = {
            "seasonality": "auto",
            "sensitivity": "low",
            "threshold_type": 2,
        }

        mixed_anomaly = DataCondition.objects.get(id=self.mixed_anomaly_id)
        assert mixed_anomaly.comparison == default_comparison
        assert not DataCondition.objects.filter(id__in=self.mixed_static_ids).exists()

        anomalies_only = DataCondition.objects.filter(id__in=self.anomalies_only_ids).order_by("id")
        assert anomalies_only.count() == 2
        assert list(anomalies_only.values_list("comparison", flat=True)) == [
            default_comparison,
            default_comparison,
        ]

        single_anomaly = DataCondition.objects.get(id=self.single_anomaly_id)
        assert single_anomaly.comparison == {
            "seasonality": "daily",
            "sensitivity": "medium",
            "threshold_type": 1,
        }

        assert DataCondition.objects.filter(id__in=self.static_condition_ids).count() == 2
