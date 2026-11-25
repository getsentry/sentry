import logging

from django.db import Error as DjangoDBError
from django.db import router, transaction

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.incidents.utils.types import DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
from sentry.snuba.models import QuerySubscription
from sentry.snuba.tasks import remove_remote_subscription
from sentry.utils import metrics
from sentry.workflow_engine.models.data_source_detector import DataSourceDetector
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.types import DetectorType

logger = logging.getLogger(__name__)


class DataSourceDetectorDeletionTask(ModelDeletionTask[DataSourceDetector]):
    def delete_instance(self, instance: DataSourceDetector) -> None:
        from sentry.workflow_engine.models import DataSource

        with transaction.atomic(using=router.db_for_write(DataSource)):
            source = DataSource.objects.select_for_update().get_or_none(id=instance.data_source_id)
            if (
                source is None
                or DataSourceDetector.objects.filter(data_source=source)
                .exclude(id=instance.id)
                .exists()
            ):
                # Release our link under the lock so the last owner will clean up the source.
                super().delete_instance(instance)
                return

        # Keep the final link until the local cascade succeeds. Snuba I/O runs outside the lock.
        if (
            source.type == DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
            and instance.detector.type == DetectorType.METRIC_ISSUE
        ):
            subscription = QuerySubscription.objects.get_or_none(
                id=source.source_id, project_id=instance.detector.project_id
            )
            if subscription is not None:
                try:
                    remove_remote_subscription(subscription)
                except DjangoDBError:
                    raise
                except Exception:
                    # The result consumer can unsubscribe after the local row is gone.
                    logger.exception(
                        "detector.deletion.unsubscribe_failed",
                        extra={"query_subscription_id": subscription.id},
                    )
                    metrics.incr("snuba.subscriptions.detector_delete.failed")

        self.delete_children([ModelRelation(DataSource, {"id": source.id})])


class DetectorDeletionTask(ModelDeletionTask[Detector]):
    manager_name = "objects_for_deletion"

    def get_child_relations(self, instance: Detector) -> list[BaseRelation]:
        from sentry.incidents.models.alert_rule import AlertRule
        from sentry.workflow_engine.models import (
            AlertRuleDetector,
            DataConditionGroup,
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

        model_relations.append(
            ModelRelation(
                DataSourceDetector,
                {"detector_id": instance.id},
                task=DataSourceDetectorDeletionTask,
            )
        )

        if instance.workflow_condition_group_id:
            model_relations.append(
                ModelRelation(DataConditionGroup, {"id": instance.workflow_condition_group_id})
            )

        return model_relations

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
