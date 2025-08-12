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
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import Incident
from sentry.models.groupopenperiod import GroupOpenPeriod
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

            # Try to find the active incident for this alert rule and project
            try:
                alert_rule = AlertRule.objects.get(id=alert_id)
                incident = Incident.objects.get_active_incident(
                    alert_rule=alert_rule,
                    project=group.project,
                )
            except AlertRule.DoesNotExist:
                logger.warning(
                    "AlertRule not found for alert_id",
                    extra={
                        "alert_id": alert_id,
                        "group_id": group.id,
                    },
                )
                incident = None

            if incident:
                # Incident exists, create the relationship immediately
                return self.create_relationship(incident, open_period)
            else:
                # Incident doesn't exist yet, create a placeholder relationship
                # that will be updated when the incident is created
                return self.create_placeholder_relationship(detector_id, open_period, group.project)

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

    @classmethod
    def create_placeholder_relationship(self, detector_id, open_period, project):
        """
        Creates a placeholder relationship when the incident doesn't exist yet.
        This will be updated when the incident is created.

        Args:
            detector_id: The detector ID
            open_period: The GroupOpenPeriod to link
            project: The project for the group
        """
        try:
            # Store the alert_id in the open_period data for later lookup
            data = open_period.data or {}
            data["pending_incident_detector_id"] = detector_id
            open_period.update(data=data)

            return None

        except Exception as e:
            logger.exception(
                "Failed to create placeholder IncidentGroupOpenPeriod relationship",
                extra={
                    "detector_id": detector_id,
                    "open_period_id": open_period.id,
                    "error": str(e),
                },
            )
            return None

    @classmethod
    def create_pending_relationships_for_incident(self, incident, alert_rule):
        """
        Creates IncidentGroupOpenPeriod relationships for any groups that were created
        before the incident. This handles the timing issue where groups might be created
        before incidents.

        Args:
            incident: The Incident that was just created
            alert_rule: The AlertRule that triggered the incident
        """
        try:
            # Find all open periods that have a pending incident detector_id for this alert rule
            detector_id = AlertRuleDetector.objects.get(alert_rule_id=alert_rule.id).detector_id
            pending_open_periods = GroupOpenPeriod.objects.filter(
                data__pending_incident_detector_id=detector_id,
                group__project__in=incident.projects.all(),
            )

            for open_period in pending_open_periods:
                # Create the relationship
                relationship = self.create_relationship(incident, open_period)
                if relationship:
                    # Remove the pending flag from the open_period data
                    data = open_period.data or {}
                    data.pop("pending_incident_detector_id", None)
                    open_period.update(data=data)

        except Exception as e:
            logger.exception(
                "Failed to create pending IncidentGroupOpenPeriod relationships",
                extra={
                    "incident_id": incident.id,
                    "alert_rule_id": alert_rule.id,
                    "error": str(e),
                },
            )
