import logging

from django.db import models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)
from sentry.incidents.logic import create_incident
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import IncidentType
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector

logger = logging.getLogger(__name__)


@region_silo_model
class IncidentGroupOpenPeriod(DefaultFieldsModel):
    """
    A lookup model for incidents and group open periods.
    """

    __relocation_scope__ = RelocationScope.Excluded

    incident_id = BoundedBigIntegerField(null=True, unique=True)
    incident_identifier = models.IntegerField(null=True)
    group_open_period = FlexibleForeignKey("sentry.GroupOpenPeriod", unique=True)

    class Meta:
        db_table = "workflow_engine_incidentgroupopenperiod"
        app_label = "workflow_engine"
        constraints = [
            models.CheckConstraint(
                condition=Q(incident_identifier__isnull=False) & Q(incident_id__isnull=False)
                | Q(incident_identifier__isnull=True) & Q(incident_id__isnull=True),
                name="inc_id_inc_identifier_together",
            )
        ]

    @classmethod
    def create_from_occurrence(self, occurrence, group, open_period):
        """
        Creates an IncidentGroupOpenPeriod relationship from an issue occurrence.
        This method handles the case where the incident might not exist yet.

        Args:
            occurrence: The IssueOccurrence that triggered the group creation
            group: The Group that was created
            open_period: The GroupOpenPeriod for the group
        """
        try:
            # Extract alert_id from evidence_data using the detector_id
            detector_id = occurrence.evidence_data.get("detector_id")
            if detector_id:
                alert_id = AlertRuleDetector.objects.get(detector_id=detector_id).alert_rule_id
            else:
                raise Exception("No detector_id found in evidence_data for metric issue")

            # XXX: is the order of operations okay here? who knows.
            # If the relationship was previously created, return it
            relationship = self.get_relationship(open_period)
            if relationship is not None:
                return relationship

            try:
                alert_rule = AlertRule.objects.get(id=alert_id)

            except AlertRule.DoesNotExist:
                logger.warning(
                    "AlertRule not found for alert_id",
                    extra={
                        "alert_id": alert_id,
                        "group_id": group.id,
                    },
                )

            # Extract query subscription id from evidence_data
            source_id = occurrence.evidence_data.get("data_packet_source_id")
            if source_id:
                subscription = QuerySubscription.objects.get(id=int(source_id))
            else:
                raise Exception("No source_id found in evidence_data for metric issue")

            incident = create_incident(
                organization=alert_rule.organization,
                incident_type=IncidentType.ALERT_TRIGGERED,
                title=alert_rule.name,
                alert_rule=alert_rule,
                date_started=open_period.date_started,  # XXX: this was detected_at in the legacy system; could add that here too
                date_detected=open_period.date_started,
                projects=[group.project],
                subscription=subscription,
            )

            return self.create_relationship(incident, open_period)

        except Exception as e:
            logger.exception(
                "Failed to create IncidentGroupOpenPeriod relationship",
                extra={
                    "group_id": group.id,
                    "occurrence_id": occurrence.id,
                    "error": str(e),
                },
            )
            return None

    @classmethod
    def get_relationship(self, open_period):
        """
        Returns the open period if it exists
        """
        return self.objects.filter(group_open_period=open_period).first()

    @classmethod
    def create_relationship(self, incident, open_period):
        """
        Creates IncidentGroupOpenPeriod relationship.

        Args:
            incident: The Incident to link
            open_period: The GroupOpenPeriod to link
        """
        try:
            incident_group_open_period, _ = self.objects.get_or_create(
                group_open_period=open_period,
                defaults={
                    "incident_id": incident.id,
                    "incident_identifier": incident.identifier,
                },
            )

            return incident_group_open_period

        except Exception as e:
            logger.exception(
                "Failed to create/update IncidentGroupOpenPeriod relationship",
                extra={
                    "incident_id": incident.id,
                    "open_period_id": open_period.id,
                    "error": str(e),
                },
            )
            return None
