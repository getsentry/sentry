from sentry.api.serializers import serialize
from sentry.incidents.grouptype import MetricAlertFire
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import DataCondition, DataConditionGroup, DataSource, Detector
from sentry.workflow_engine.types import DetectorPriorityLevel


class TestDetectorSerializer(TestCase):
    def test_serialize_simple(self):
        detector = Detector.objects.create(
            organization_id=self.organization.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
        )

        result = serialize(detector)

        assert result == {
            "id": str(detector.id),
            "organizationId": str(self.organization.id),
            "name": "Test Detector",
            "type": MetricAlertFire.slug,
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": None,
            "conditionGroup": None,
        }

    def test_serialize_full(self):
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = DataCondition.objects.create(
            condition_group=condition_group,
            condition="gt",
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )
        detector = Detector.objects.create(
            organization_id=self.organization.id,
            name="Test Detector",
            type=MetricAlertFire.slug,
            workflow_condition_group=condition_group,
        )
        data_source = DataSource.objects.create(
            organization_id=self.organization.id,
            type=DataSource.Type.SNUBA_QUERY_SUBSCRIPTION,
            query_id=1,
        )
        data_source.detectors.set([detector])

        result = serialize(detector)

        assert result == {
            "id": str(detector.id),
            "organizationId": str(self.organization.id),
            "name": "Test Detector",
            "type": MetricAlertFire.slug,
            "dateCreated": detector.date_added,
            "dateUpdated": detector.date_updated,
            "dataSources": [
                {
                    "id": str(data_source.id),
                    "organizationId": str(self.organization.id),
                    "type": 1,
                    "queryId": "1",
                }
            ],
            "conditionGroup": {
                "id": str(condition_group.id),
                "organizationId": str(self.organization.id),
                "logicType": DataConditionGroup.Type.ANY,
                "conditions": [
                    {
                        "id": str(condition.id),
                        "condition": "gt",
                        "comparison": 100,
                        "result": DetectorPriorityLevel.HIGH,
                    }
                ],
            },
        }

    def test_serialize_bulk(self):
        detectors = [
            Detector.objects.create(
                organization_id=self.organization.id,
                name=f"Test Detector {i}",
                type=MetricAlertFire.slug,
            )
            for i in range(2)
        ]

        result = serialize(detectors)

        assert len(result) == 2
        assert all(d["name"] in ["Test Detector 0", "Test Detector 1"] for d in result)


class TestDataSourceSerializer(TestCase):
    def test_serialize(self):
        data_source = DataSource.objects.create(
            organization_id=self.organization.id,
            type=DataSource.Type.SNUBA_QUERY_SUBSCRIPTION,
            query_id=1,
        )

        result = serialize(data_source)

        assert result == {
            "id": str(data_source.id),
            "organizationId": str(self.organization.id),
            "type": DataSource.Type.SNUBA_QUERY_SUBSCRIPTION,
            "queryId": "1",
        }


class TestDataConditionGroupSerializer(TestCase):
    def test_serialize_simple(self):
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [],
        }

    def test_serialize_with_conditions(self):
        condition_group = DataConditionGroup.objects.create(
            organization_id=self.organization.id,
            logic_type=DataConditionGroup.Type.ANY,
        )
        condition = DataCondition.objects.create(
            condition_group=condition_group,
            condition="gt",
            comparison=100,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        result = serialize(condition_group)

        assert result == {
            "id": str(condition_group.id),
            "organizationId": str(self.organization.id),
            "logicType": DataConditionGroup.Type.ANY,
            "conditions": [
                {
                    "id": str(condition.id),
                    "condition": "gt",
                    "comparison": 100,
                    "result": DetectorPriorityLevel.HIGH,
                }
            ],
        }
