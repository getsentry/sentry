from sentry.constants import ObjectStatus
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DetectorTest(BaseWorkflowTest):
    def setUp(self) -> None:
        self.detector = self.create_detector()

    def test_queryset(self) -> None:
        """
        Test that we filter out objects with statuses other than 'active'
        """
        assert Detector.objects.filter(id=self.detector.id).exists()
        self.detector.status = ObjectStatus.PENDING_DELETION
        self.detector.save()
        assert not Detector.objects.filter(id=self.detector.id).exists()

        self.detector.status = ObjectStatus.DELETION_IN_PROGRESS
        self.detector.save()
        assert not Detector.objects.filter(id=self.detector.id).exists()

    def test_get_conditions__cached(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .prefetch_related("workflow_condition_group__conditions")
            .first()
        )

        assert fetched_detector is not None
        with self.assertNumQueries(0):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_conditions__cached_group_only(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()
        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = (
            Detector.objects.filter(id=self.detector.id)
            .select_related("workflow_condition_group")
            .first()
        )

        assert fetched_detector is not None
        with self.assertNumQueries(1):
            conditions = fetched_detector.get_conditions()
            assert conditions

    def test_get_conditions__not_cached(self) -> None:
        self.detector.workflow_condition_group = self.create_data_condition_group()
        self.detector.save()

        self.create_data_condition(
            type="eq",
            comparison="HIGH",
            condition_group=self.detector.workflow_condition_group,
            condition_result=DetectorPriorityLevel.HIGH,
        )

        fetched_detector = Detector.objects.get(id=self.detector.id)
        with self.assertNumQueries(1):
            conditions = fetched_detector.get_conditions()
            assert conditions
