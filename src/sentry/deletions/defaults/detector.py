import logging

from django.db import router, transaction

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    manager_name = "objects_for_deletion"

    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.workflow_engine.models import (
            AlertRuleDetector,
            DataConditionGroup,
            DataSource,
        )

        model_relations: list[BaseRelation] = []

        # If this detector was dual-written from an AlertRule, cascade deletion
        # to the AlertRule. AlertRuleDeletionTask will handle cleaning up
        # AlertRuleDetector and AlertRuleWorkflow.
        # NOTE: AlertRule must be deleted before DataSource so that
        # QuerySubscriptionDeletionTask sees no remaining AlertRule referencing
        # the SnubaQuery and can safely delete it.
        alert_rule_ids = list(
            AlertRuleDetector.objects_for_deletion.filter(detector_id=instance.id).values_list(
                "alert_rule_id", flat=True
            )
        )
        if alert_rule_ids:
            model_relations.append(ModelRelation(AlertRule, {"id__in": alert_rule_ids}))

        owned_source_ids = self._detach_shared_sources(instance)
        model_relations.append(ModelRelation(DataSource, {"id__in": owned_source_ids}))

        if instance.workflow_condition_group_id:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group_id})
            )

        return model_relations

    def _detach_shared_sources(self, instance: Detector) -> set[int]:
        # Deletion relation validation inspects unsaved instances, which own no sources.
        if instance.pk is None:
            return set()

        # Concurrent deletions of the last two detectors must agree on which one
        # owns cleanup. Keep exclusive links until the child deletion succeeds.
        with transaction.atomic(using=router.db_for_write(DataSourceDetector)):
            source_ids = set(
                instance.data_sources.order_by("id")
                .select_for_update(of=("self",))
                .values_list("id", flat=True)
            )
            links = DataSourceDetector.objects.filter(data_source_id__in=source_ids)
            shared_ids = set(
                links.exclude(detector=instance).values_list("data_source_id", flat=True)
            )
            if shared_ids:
                links.filter(detector=instance, data_source_id__in=shared_ids).delete()
            return source_ids - shared_ids

    def delete_instance(self, instance: Detector) -> None:
        from sentry.uptime.subscriptions.subscriptions import remove_uptime_seat
        from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE

        if instance.type == GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE:
            try:
                remove_uptime_seat(instance)
            except Exception:
                logger.warning(
                    "detector.deletion.remove_uptime_seat_failed",
                    extra={"detector_id": instance.id},
                    exc_info=True,
                )

        super().delete_instance(instance)
