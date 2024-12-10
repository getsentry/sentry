from django.db import router, transaction
from rest_framework import serializers

from sentry.models.project import Project
from sentry.workflow_engine.detectors.error import ErrorDetector
from sentry.workflow_engine.endpoints.validators.base import BaseGroupTypeDetectorValidator
from sentry.workflow_engine.models.detector import Detector


class ErrorDetectorValidator(BaseGroupTypeDetectorValidator):
    def create(self, validated_data):
        with transaction.atomic(router.db_for_write(Detector)):
            detector: ErrorDetector = ErrorDetector.objects.create(
                project_id=self.context["project"].id,
                organization_id=self.context["project"].organization_id,
                name=validated_data["name"],
                # no workflow_condition_group
                type=validated_data["group_type"].slug,
            )

            project: Project | None = detector.project
            if not project:
                raise serializers.ValidationError("Error detector must have a project")

            # TODO: audit log entry?
        return detector
