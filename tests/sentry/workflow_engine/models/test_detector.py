from sentry.constants import ObjectStatus
from sentry.workflow_engine.models import Detector
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class DetectorTest(BaseWorkflowTest):
    def setUp(self):
        self.detector = self.create_detector()

    def test_queryset(self):
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
