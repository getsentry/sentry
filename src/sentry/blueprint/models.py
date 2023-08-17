import logging

from django.db import models, router, transaction

from sentry.db.models import FlexibleForeignKey, JSONField, Model, region_silo_only_model
from sentry.db.models.manager.base import BaseManager

logger = logging.getLogger(__name__)


@region_silo_only_model
class AlertTemplateIssueAlert(Model):
    __include_in_export__ = False

    rule = FlexibleForeignKey("sentry.Rule")
    template = FlexibleForeignKey("sentry.AlertTemplate")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alerttemplateissuealert"


class AlertTemplateManager(BaseManager):
    def create_from_issue_alert(self, organization_id: int, rule_id: int):
        from sentry.models.rule import Rule

        rule = Rule.objects.get(rule_id=rule_id, project__organization_id=organization_id)
        with transaction.atomic(router.db_for_write(Rule)):
            procedure = AlertProcedure.objects.create_from_issue_alert(
                organization_id=organization_id, rule_id=rule_id
            )
            template = AlertTemplate.objects.filter(
                organization_id=organization_id,
                procedure=procedure,
                issue_alerts_data=rule.data,
            ).first()

            if template:
                AlertTemplateIssueAlert.objects.create(rule_id=rule.id, template_id=template.id)
                return template

            return AlertTemplate.objects.get_or_create(
                name=f"[Template] {rule.label}",
                organization_id=organization_id,
                procedure=procedure,
                issue_alerts__id=rule.id,
                issue_alerts_data=rule.data,
            )


@region_silo_only_model
class AlertTemplate(Model):
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    name = models.CharField(max_length=128)
    issue_alerts = models.ManyToManyField("sentry.Rule", through=AlertTemplateIssueAlert)
    issue_alert_data = JSONField(default={})
    procedure = FlexibleForeignKey("sentry.AlertProcedure")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alerttemplate"

    objects = AlertTemplateManager()


class AlertProcedureManager(BaseManager):
    def create_from_issue_alert(self, organization_id: int, rule_id: int):
        from sentry.models.rule import Rule

        rule = Rule.objects.get(rule_id=rule_id, project__organization_id=organization_id)
        existing_procedure = AlertProcedure.objects.filter(
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
    __include_in_export__ = False

    organization = FlexibleForeignKey("sentry.Organization")
    label = models.CharField(max_length=255)
    is_manual = models.BooleanField(default=False)
    issue_alert_actions = JSONField(default=[])

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertprocedure"

    objects = AlertProcedureManager()
