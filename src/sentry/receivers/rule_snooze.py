from django.db.models.signals import post_save, pre_delete

from sentry.models.rulesnooze import RuleSnooze
from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow


def _update_workflow_engine_models(instance: RuleSnooze, is_enabled: bool) -> None:
    if instance.rule:
        alert_rule_workflow = AlertRuleWorkflow.objects.filter(rule=instance.rule).first()
        if alert_rule_workflow and alert_rule_workflow.workflow:
            alert_rule_workflow.workflow.update(enabled=is_enabled)

    elif instance.alert_rule:
        alert_rule_detector = AlertRuleDetector.objects.filter(
            alert_rule=instance.alert_rule
        ).first()
        if alert_rule_detector and alert_rule_detector.detector:
            alert_rule_detector.detector.update(enabled=is_enabled)


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
