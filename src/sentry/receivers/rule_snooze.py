from django.db.models.signals import post_save, pre_delete

from sentry.models.rulesnooze import RuleSnooze
from sentry.utils.cache import cache
from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow
from sentry.workflow_engine.models.detector import Detector


def _update_workflow_engine_models(instance: RuleSnooze, is_enabled: bool) -> None:
    if instance.user_id is not None:
        return

    if instance.rule:
        alert_rule_workflow = AlertRuleWorkflow.objects.filter(rule_id=instance.rule.id).first()
        if alert_rule_workflow and alert_rule_workflow.workflow:
            alert_rule_workflow.workflow.update(enabled=is_enabled)

    elif instance.alert_rule:
        alert_rule_detector = AlertRuleDetector.objects.filter(
            alert_rule_id=instance.alert_rule.id
        ).first()
        if alert_rule_detector and alert_rule_detector.detector:
            detector = alert_rule_detector.detector
            detector.update(enabled=is_enabled)

            # Invalidate cache for all data sources associated with the detector
            data_sources = detector.data_sources.values_list("source_id", "type")
            for source_id, source_type in data_sources:
                cache_key = Detector._get_detectors_by_data_source_cache_key(source_id, source_type)
                cache.delete(cache_key)


def disable_workflow_engine_models(instance: RuleSnooze, created, **kwargs):
    if not created:
        return
    _update_workflow_engine_models(instance, is_enabled=False)


def enable_workflow_engine_models(instance: RuleSnooze, **kwargs) -> None:
    _update_workflow_engine_models(instance, is_enabled=True)


post_save.connect(
    disable_workflow_engine_models,
    sender=RuleSnooze,
    dispatch_uid="disable_workflow_engine_models",
    weak=False,
)
pre_delete.connect(
    enable_workflow_engine_models,
    sender=RuleSnooze,
    dispatch_uid="enable_workflow_engine_models",
    weak=False,
)
