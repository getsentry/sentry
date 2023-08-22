import logging

from django.db import models, router, transaction

from sentry.db.models import FlexibleForeignKey, JSONField, Model, region_silo_only_model
from sentry.db.models.manager.base import BaseManager

logger = logging.getLogger(__name__)


class AlertTemplateManager(BaseManager):
    def create_from_issue_alert(self, organization_id: int, rule_id: int):
        from sentry.models.rule import Rule

        rule = Rule.objects.get(rule_id=rule_id, project__organization_id=organization_id)
        with transaction.atomic(router.db_for_write(Rule)):
            procedure = AlertProcedure.objects.create_from_issue_alert(
                organization_id=organization_id, rule_id=rule_id
            )
            template = AlertTemplate.objects.get_or_create(
                name=f"[Template from Alert] {rule.label}",
                organization_id=organization_id,
                procedure=procedure,
                issue_alerts_data=rule.data,
                owner=rule.owner,
            )
            rule.update(template_id=template.id)
            return template


@region_silo_only_model
class AlertTemplate(Model):
    __include_in_export__ = True

    owner = FlexibleForeignKey("sentry.Actor", null=True, on_delete=models.SET_NULL)
    procedure = FlexibleForeignKey("sentry.AlertProcedure", null=True, on_delete=models.SET_NULL)
    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=128)
    issue_alert_data = JSONField(default={})

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alerttemplate"
        unique_together = (("organization", "name"),)

    objects = AlertTemplateManager()


class AlertProcedureManager(BaseManager):
    def create_from_issue_alert(self, organization_id: int, rule_id: int):
        from sentry.models.rule import Rule

        rule = Rule.objects.get(id=rule_id, project__organization_id=organization_id)
        return AlertProcedure.objects.get_or_create(
            label=f"[Procedure from Alert] {rule.label}",
            organization_id=organization_id,
            is_manual=False,
            issue_alert_actions=rule.data.get("actions", {}),
            owner=rule.owner,
        ).first()


@region_silo_only_model
class AlertProcedure(Model):
    __include_in_export__ = True

    owner = FlexibleForeignKey("sentry.Actor", null=True, on_delete=models.SET_NULL)
    organization = FlexibleForeignKey("sentry.Organization")
    label = models.CharField(max_length=255)
    is_manual = models.BooleanField(default=False)
    issue_alert_actions = JSONField(default=[])

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertprocedure"
        unique_together = (("organization", "label"),)

    objects = AlertProcedureManager()
