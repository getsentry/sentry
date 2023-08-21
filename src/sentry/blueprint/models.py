import logging

from django.db import models, router, transaction

from sentry.db.models import FlexibleForeignKey, JSONField, Model, region_silo_only_model
from sentry.db.models.manager.base import BaseManager

logger = logging.getLogger(__name__)


class AlertTemplateManager(BaseManager):
    def create_from_issue_alert(self, organization_id: int, rule_id: int):
        from sentry.models.rule import Rule

        rule = Rule.objects.get(id=rule_id, project__organization_id=organization_id)
        with transaction.atomic(router.db_for_write(Rule)):
            procedure = AlertProcedure.objects.create_from_issue_alert(
                organization_id=organization_id, rule_id=rule_id
            )
            template = AlertTemplate.objects.filter(
                organization_id=organization_id,
                procedure=procedure,
                issue_alert_data=rule.data,
            ).first()

            if template:
                rule.update(template_id=template.id)
                return template
            template, created = AlertTemplate.objects.get_or_create(
                name=f"[Template] {rule.label}",
                organization_id=organization_id,
                procedure=procedure,
                issue_alert_data=rule.data,
            )
            rule.update(template_id=template.id)
            return template


@region_silo_only_model
class AlertTemplate(Model):
    __include_in_export__ = True

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=128)
    issue_alert_data = JSONField(default={})
    procedure = FlexibleForeignKey("sentry.AlertProcedure")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alerttemplate"
        unique_together = (("organization", "name"),)

    objects = AlertTemplateManager()


class AlertProcedureManager(BaseManager):
    def create_from_issue_alert(self, organization_id: int, rule_id: int):
        from sentry.models.rule import Rule

        rule = Rule.objects.get(id=rule_id, project__organization_id=organization_id)
        existing_procedure = AlertProcedure.objects.filter(
            label=f"[Procedure] {rule.label}",
            organization_id=organization_id,
            is_manual=False,
            issue_alert_actions=rule.data.get("actions", {}),
        ).first()
        if existing_procedure:
            return existing_procedure
        return AlertProcedure.objects.create(
            label=f"[Procedure] {rule.label}",
            organization_id=organization_id,
            is_manual=False,
            issue_alert_actions=rule.data.get("actions", {}),
        )


@region_silo_only_model
class AlertProcedure(Model):
    __include_in_export__ = True

    organization = FlexibleForeignKey("sentry.Organization")
    label = models.CharField(max_length=255)
    is_manual = models.BooleanField(default=False)
    issue_alert_actions = JSONField(default=[])

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertprocedure"
        unique_together = (("organization", "label"),)

    objects = AlertProcedureManager()
