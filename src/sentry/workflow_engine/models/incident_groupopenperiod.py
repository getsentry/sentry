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
from sentry.incidents.models.incident import Incident
from sentry.models.groupopenperiod import GroupOpenPeriod

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
    def create_from_occurrence(cls, occurrence, group, open_period):
        """
        Creates an IncidentGroupOpenPeriod relationship from an issue occurrence.
        This method handles the case where the incident might not exist yet.

        Args:
            occurrence: The IssueOccurrence that triggered the group creation
            group: The Group that was created
            open_period: The GroupOpenPeriod for the group
        """
        try:
            # Extract alert_id from evidence_data
            alert_id = occurrence.evidence_data.get("alert_id")
            if not alert_id:
                logger.warning(
                    "No alert_id found in evidence_data for metric issue",
                    extra={
                        "group_id": group.id,
                        "occurrence_id": occurrence.id,
                    },
                )
                return None

            # Try to find the active incident for this alert rule and project
            incident = Incident.objects.get_active_incident(
                alert_rule_id=alert_id,
                project=group.project,
            )

            if incident:
                # Incident exists, create the relationship immediately
                return cls.create_relationship(incident, open_period)
            else:
                # Incident doesn't exist yet, create a placeholder relationship
                # that will be updated when the incident is created
                return cls.create_placeholder_relationship(alert_id, open_period, group.project)

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
    def create_relationship(cls, incident, open_period):
        """
        Creates or updates an IncidentGroupOpenPeriod relationship.

        Args:
            incident: The Incident to link
            open_period: The GroupOpenPeriod to link
        """
        try:
            # Create the relationship (or get existing one)
            incident_group_open_period, created = cls.objects.get_or_create(
                group_open_period=open_period,
                defaults={
                    "incident_id": incident.id,
                    "incident_identifier": incident.identifier,
                },
            )

            # Update incident_id if it changed (e.g., if a new incident was created)
            if not created and incident_group_open_period.incident_id != incident.id:
                incident_group_open_period.incident_id = incident.id
                incident_group_open_period.incident_identifier = incident.identifier
                incident_group_open_period.save(
                    update_fields=["incident_id", "incident_identifier"]
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
    def create_placeholder_relationship(cls, alert_id, open_period, project):
        """
        Creates a placeholder relationship when the incident doesn't exist yet.
        This will be updated when the incident is created.

        Args:
            alert_id: The alert rule ID
            open_period: The GroupOpenPeriod to link
            project: The project for the group
        """
        try:
            # Store the alert_id in the open_period data for later lookup
            data = open_period.data or {}
            data["pending_incident_alert_id"] = alert_id
            open_period.update(data=data)

            return None

        except Exception as e:
            logger.exception(
                "Failed to create placeholder IncidentGroupOpenPeriod relationship",
                extra={
                    "alert_id": alert_id,
                    "open_period_id": open_period.id,
                    "error": str(e),
                },
            )
            return None

    @classmethod
    def create_pending_relationships_for_incident(cls, incident, alert_rule):
        """
        Creates IncidentGroupOpenPeriod relationships for any groups that were created
        before the incident. This handles the timing issue where groups might be created
        before incidents.

        Args:
            incident: The Incident that was just created
            alert_rule: The AlertRule that triggered the incident
        """
        try:
            # Find all open periods that have a pending incident alert_id for this alert rule
            pending_open_periods = GroupOpenPeriod.objects.filter(
                data__pending_incident_alert_id=alert_rule.id,
                group__project=incident.project,
            )

            for open_period in pending_open_periods:
                # Create the relationship
                relationship = cls.create_relationship(incident, open_period)
                if relationship:
                    # Remove the pending flag from the open_period data
                    data = open_period.data or {}
                    data.pop("pending_incident_alert_id", None)
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
