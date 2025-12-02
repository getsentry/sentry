from django.db.models.signals import post_save, pre_delete

from sentry import audit_log
from sentry.models.rulesnooze import RuleSnooze
from sentry.utils.audit import create_audit_entry_from_user
from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow


def _update_workflow_engine_models(instance: RuleSnooze, is_enabled: bool) -> None:
    if instance.user_id is not None:
        return

    if instance.rule:
        alert_rule_workflow = AlertRuleWorkflow.objects.filter(rule_id=instance.rule.id).first()
        if alert_rule_workflow and alert_rule_workflow.workflow:
            workflow = alert_rule_workflow.workflow
            workflow.update(enabled=is_enabled)
            create_audit_entry_from_user(
                user=None,
                organization_id=workflow.organization,
                target_object=workflow.id,
                data=workflow.get_audit_log_data(),
                event=audit_log.get_event_id("WORKFLOW_EDIT"),
            )
    elif instance.alert_rule:
        alert_rule_detector = AlertRuleDetector.objects.filter(
            alert_rule_id=instance.alert_rule.id
        ).first()
        if alert_rule_detector and alert_rule_detector.detector:
            detector = alert_rule_detector.detector
            detector.update(enabled=is_enabled)
            create_audit_entry_from_user(
                user=None,
                organization_id=detector.project.organization,
                target_object=detector.id,
                data=detector.get_audit_log_data(),
                event=audit_log.get_event_id("DETECTOR_EDIT"),
            )


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
