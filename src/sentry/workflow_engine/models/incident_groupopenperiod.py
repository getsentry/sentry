import logging

from django.db import IntegrityError, models
from django.db.models import Q

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    DefaultFieldsModel,
    FlexibleForeignKey,
    region_silo_model,
)
from sentry.incidents.models.alert_rule import AlertRule
from sentry.incidents.models.incident import IncidentType
from sentry.models.group import Group, GroupStatus
from sentry.models.groupopenperiod import get_latest_open_period
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.models import DetectorGroup
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector
from sentry.workflow_engine.types import DetectorPriorityLevel

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
            # Extract alert_id from evidence_data using the detector_id
            detector_id = occurrence.evidence_data.get("detector_id")
            if detector_id:
                try:
                    alert_id = AlertRuleDetector.objects.get(detector_id=detector_id).alert_rule_id
                except AlertRuleDetector.DoesNotExist:
                    # detector does not have an analog in the old system, so we do not need to create an IGOP relationship
                    return None
            else:
                raise Exception("No detector_id found in evidence_data for metric issue")

            # If the relationship was previously created, return it
            relationship = cls.get_relationship(open_period)
            if relationship is not None:
                return relationship

            # Otherwise, this is a new open period, so create the incident and IGOP relationship
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
                raise

            incident = cls.create_incident_for_open_period(
                occurrence, alert_rule, group, open_period
            )
            return cls.create_relationship(incident, open_period)

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
    def create_incident_for_open_period(cls, occurrence, alert_rule, group, open_period):
        from sentry.incidents.logic import create_incident, update_incident_status
        from sentry.incidents.models.incident import Incident, IncidentStatus, IncidentStatusMethod
        from sentry.incidents.utils.process_update_helpers import (
            calculate_event_date_from_update_date,
        )

        # XXX: to patch incidents that never closed when open periods were closed by means
        # other than an emitted detector status change: if an open incident exists when we
        # get here, close it.
        open_incident = (
            Incident.objects.filter(alert_rule__id=alert_rule.id, date_closed=None)
            .order_by("-date_started")
            .first()
        )
        if open_incident is not None:
            try:
                incident_group_open_period = cls.objects.get(
                    incident_id=open_incident.id,
                )
                old_open_period = incident_group_open_period.group_open_period
                if old_open_period.date_ended is None:
                    raise Exception("Outdated open period missing date_ended")

                if open_incident.subscription_id is not None:
                    subscription = QuerySubscription.objects.select_related("snuba_query").get(
                        id=int(open_incident.subscription_id)
                    )
                    time_window = subscription.snuba_query.time_window
                else:
                    time_window = 0
                calculated_date_closed = calculate_event_date_from_update_date(
                    old_open_period.date_ended, time_window
                )
                update_incident_status(
                    open_incident,
                    IncidentStatus.CLOSED,
                    status_method=IncidentStatusMethod.RULE_TRIGGERED,
                    date_closed=calculated_date_closed,
                )
            except IncidentGroupOpenPeriod.DoesNotExist:
                # If there's no IGOP relationship. This can happen if the incident opened before we
                # switched to single processing, as there's a long tail here, or the incident was broken for some
                # reason.
                # Associate the ongoing incident with the current open period. We'll start correct associations
                # with the next open period.
                return open_incident

        # Extract query subscription id from evidence_data
        source_id = occurrence.evidence_data.get("data_packet_source_id")
        if source_id:
            subscription = QuerySubscription.objects.get(id=int(source_id))
            snuba_query = SnubaQuery.objects.get(id=subscription.snuba_query_id)
        else:
            raise Exception("No source_id found in evidence_data for metric issue")

        calculated_start_date = calculate_event_date_from_update_date(
            open_period.date_started, snuba_query.time_window
        )

        incident = create_incident(
            organization=alert_rule.organization,
            incident_type=IncidentType.ALERT_TRIGGERED,
            title=alert_rule.name,
            alert_rule=alert_rule,
            date_started=calculated_start_date,
            date_detected=open_period.date_started,
            projects=[group.project],
            subscription=subscription,
        )
        # XXX: if this is the very first open period, or if the priority didn't change from the last priority on the last open period,
        # manually add the first incident status change activity because the group never changed priority
        # if the priority changed, then the call to update_incident_status in update_priority will be a no-op
        priority = (
            occurrence.priority if occurrence.priority is not None else DetectorPriorityLevel.HIGH
        )
        severity = (
            IncidentStatus.CRITICAL
            if priority == DetectorPriorityLevel.HIGH
            else IncidentStatus.WARNING
        )  # LOW isn't used for metric issues

        update_incident_status(
            incident,
            severity,
            status_method=IncidentStatusMethod.RULE_TRIGGERED,
        )
        return incident

    @classmethod
    def get_relationship(cls, open_period):
        """
        Returns the IncidentGroupOpenPeriod relationship if it exists.
        """
        return cls.objects.filter(group_open_period=open_period).first()

    @classmethod
    def create_relationship(cls, incident, open_period):
        """
        Creates IncidentGroupOpenPeriod relationship.

        Args:
            incident: The Incident to link
            open_period: The GroupOpenPeriod to link
        """
        try:
            incident_group_open_period, _ = cls.objects.get_or_create(
                group_open_period=open_period,
                defaults={
                    "incident_id": incident.id,
                    "incident_identifier": incident.identifier,
                },
            )

            return incident_group_open_period

        except IntegrityError:
            incident_group_open_period = cls.objects.get(
                group_open_period=open_period,
                incident_id=incident.id,
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


def update_incident_activity_based_on_group_activity(
    group: Group,
    priority: PriorityLevel,
) -> None:
    from sentry.incidents.logic import update_incident_status
    from sentry.incidents.models.incident import Incident, IncidentStatus, IncidentStatusMethod

    open_period = get_latest_open_period(group)
    if open_period is None:
        logger.warning("No open period found for group", extra={"group_id": group.id})
        return

    # get the incident for the open period
    try:
        incident_id = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period).incident_id
        incident = Incident.objects.get(id=incident_id)

    except IncidentGroupOpenPeriod.DoesNotExist:
        # This could happen because the priority changed when opening the period, but
        # the priority change came before relationship creation. This isn't a problem—we create the
        # relationship with the new priority in create_from_occurrence() anyway.

        # We could also hit this case if there are outstanding open incidents when switching to single
        # processing. Again, create_from_occurrence() will handle any status changes we need.

        # Finally, this can also happen if the incident was not created because a detector was single
        # written in workflow engine. Just return in this case.
        logger.info(
            "No IncidentGroupOpenPeriod relationship found when updating IncidentActivity table",
            extra={
                "open_period_id": open_period.id,
            },
        )
        return

    severity = (
        IncidentStatus.CRITICAL if priority == PriorityLevel.HIGH else IncidentStatus.WARNING
    )  # this assumes that LOW isn't used for metric issues

    update_incident_status(
        incident,
        severity,
        status_method=IncidentStatusMethod.RULE_TRIGGERED,
    )


def update_incident_based_on_open_period_status_change(
    group: Group,
    new_status: int,
) -> None:
    from sentry.incidents.logic import update_incident_status
    from sentry.incidents.models.incident import Incident, IncidentStatus, IncidentStatusMethod
    from sentry.incidents.utils.process_update_helpers import calculate_event_date_from_update_date

    open_period = get_latest_open_period(group)
    if open_period is None:
        logger.warning("No open period found for group", extra={"group_id": group.id})
        return

    # get the incident for the open period
    try:
        incident_id = IncidentGroupOpenPeriod.objects.get(group_open_period=open_period).incident_id
        incident = Incident.objects.get(id=incident_id)

    except IncidentGroupOpenPeriod.DoesNotExist:
        detector_group = DetectorGroup.objects.filter(group=group).first()
        # detector was not dual written, or this is a long-open alert that we should just close.
        if detector_group and detector_group.detector:
            detector_id = detector_group.detector.id
            try:
                alert_rule_id = AlertRuleDetector.objects.get(detector_id=detector_id).alert_rule_id
            except AlertRuleDetector.DoesNotExist:
                # Detector was not dual written.
                return
            open_incident = (
                Incident.objects.filter(alert_rule__id=alert_rule_id, date_closed=None)
                .order_by("-date_started")
                .first()
            )
            if open_incident is not None:
                incident = open_incident
                IncidentGroupOpenPeriod.create_relationship(
                    incident=incident, open_period=open_period
                )
            else:
                logger.info(
                    "No IncidentGroupOpenPeriod relationship and no outstanding incident",
                    extra={
                        "open_period_id": open_period.id,
                    },
                )
                return
        else:
            # not much we can do here
            logger.info(
                "incident_groupopenperiod.hard_fail",
                extra={
                    "group_id": group.id,
                },
            )
            return

    if incident.subscription_id is not None:
        subscription = QuerySubscription.objects.select_related("snuba_query").get(
            id=int(incident.subscription_id)
        )
        snuba_query = subscription.snuba_query  # fail loudly if this doesn't exist
    else:
        logger.warning("Incident missing subscription_id", extra={"incident_id": incident.id})
        return

    if new_status == GroupStatus.RESOLVED:
        if open_period.date_ended is None:
            logger.warning(
                "Missing information to close incident",
                extra={"group_id": group.id},
            )
            return
        calculated_date_closed = calculate_event_date_from_update_date(
            open_period.date_ended, snuba_query.time_window
        )
        update_incident_status(
            incident,
            IncidentStatus.CLOSED,
            status_method=IncidentStatusMethod.RULE_TRIGGERED,
            date_closed=calculated_date_closed,
        )
    # As far as I can tell, you can't manually unresolve a metric issue, so we shouldn't hit this case.
    # But the logic exists, so it doesn't hurt. Shrug.
    elif new_status == GroupStatus.UNRESOLVED:
        update_incident_status(
            incident,
            IncidentStatus.OPEN,
        )
