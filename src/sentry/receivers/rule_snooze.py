from django.contrib.auth.models import AnonymousUser

from sentry import audit_log
from sentry.models.rulesnooze import RuleSnooze
from sentry.users.models.user import User
from sentry.utils.audit import create_audit_entry_from_user
from sentry.workflow_engine.models import AlertRuleDetector, AlertRuleWorkflow


def _update_workflow_engine_models(
    instance: RuleSnooze, is_enabled: bool, requesting_user: User | AnonymousUser
) -> None:
    if instance.user_id is not None:
        return

    if instance.rule:
        alert_rule_workflow = AlertRuleWorkflow.objects.filter(rule_id=instance.rule.id).first()
        if alert_rule_workflow and alert_rule_workflow.workflow:
            workflow = alert_rule_workflow.workflow
            workflow.update(enabled=is_enabled)
            if isinstance(requesting_user, User):
                assert isinstance(requesting_user, User)
                create_audit_entry_from_user(
                    user=requesting_user,
                    organization_id=workflow.organization.id,
                    target_object=workflow.id,
                    data={**workflow.get_audit_log_data(), "enabled": workflow.enabled},
                    event=audit_log.get_event_id("WORKFLOW_EDIT"),
                )
    elif instance.alert_rule:
        alert_rule_detector = AlertRuleDetector.objects.filter(
            alert_rule_id=instance.alert_rule.id
        ).first()
        if alert_rule_detector and alert_rule_detector.detector:
            detector = alert_rule_detector.detector
            detector.update(enabled=is_enabled)
            if isinstance(requesting_user, User):
                assert isinstance(requesting_user, User)
                create_audit_entry_from_user(
                    user=requesting_user,
                    organization_id=detector.project.organization.id,
                    target_object=detector.id,
                    data={**detector.get_audit_log_data(), "enabled": detector.enabled},
                    event=audit_log.get_event_id("DETECTOR_EDIT"),
                )
