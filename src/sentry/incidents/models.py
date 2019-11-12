from __future__ import absolute_import

from collections import namedtuple

from django.conf import settings
from django.db import IntegrityError, models, transaction
from django.utils import timezone
from enum import Enum

from sentry.db.models import FlexibleForeignKey, Model, UUIDField
from sentry.db.models import ArrayField, sane_repr
from sentry.db.models.manager import BaseManager
from sentry.models import Team, User
from sentry.snuba.models import QueryAggregations
from sentry.utils import metrics
from sentry.utils.retries import TimedRetryPolicy


class IncidentProject(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project", db_index=False, db_constraint=False)
    incident = FlexibleForeignKey("sentry.Incident")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentproject"
        unique_together = (("project", "incident"),)


class IncidentGroup(Model):
    __core__ = False

    group = FlexibleForeignKey("sentry.Group", db_index=False, db_constraint=False)
    incident = FlexibleForeignKey("sentry.Incident")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentgroup"
        unique_together = (("group", "incident"),)


class IncidentSeen(Model):
    __core__ = False

    incident = FlexibleForeignKey("sentry.Incident")
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, db_index=False)
    last_seen = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentseen"
        unique_together = (("user", "incident"),)


class IncidentManager(BaseManager):
    def fetch_for_organization(self, organization, projects):
        return self.filter(organization=organization, projects__in=projects).distinct()

    @TimedRetryPolicy.wrap(timeout=5, exceptions=(IntegrityError,))
    def create(self, organization, **kwargs):
        """
        Creates an Incident. Fetches the maximum identifier value for the org
        and increments it by one. If two incidents are created for the
        Organization at the same time then an integrity error will be thrown,
        and we'll retry again several times. I prefer to lock optimistically
        here since if we're creating multiple Incidents a second for an
        Organization then we're likely failing at making Incidents useful.
        """
        with transaction.atomic():
            result = self.filter(organization=organization).aggregate(models.Max("identifier"))
            identifier = result["identifier__max"]
            if identifier is None:
                identifier = 1
            else:
                identifier += 1

            return super(IncidentManager, self).create(
                organization=organization, identifier=identifier, **kwargs
            )


class IncidentType(Enum):
    DETECTED = 0
    CREATED = 1
    ALERT_TRIGGERED = 2


class IncidentStatus(Enum):
    OPEN = 1
    CLOSED = 2


class Incident(Model):
    __core__ = True

    objects = IncidentManager()

    organization = FlexibleForeignKey("sentry.Organization")
    projects = models.ManyToManyField(
        "sentry.Project", related_name="incidents", through=IncidentProject
    )
    groups = models.ManyToManyField("sentry.Group", related_name="incidents", through=IncidentGroup)
    alert_rule = FlexibleForeignKey("sentry.AlertRule", null=True, on_delete=models.SET_NULL)
    # Incrementing id that is specific to the org.
    identifier = models.IntegerField()
    # Identifier used to match incoming events from the detection algorithm
    detection_uuid = UUIDField(null=True, db_index=True)
    status = models.PositiveSmallIntegerField(default=IncidentStatus.OPEN.value)
    type = models.PositiveSmallIntegerField(default=IncidentType.CREATED.value)
    aggregation = models.PositiveSmallIntegerField(default=QueryAggregations.TOTAL.value)
    title = models.TextField()
    # Query used to fetch events related to an incident
    query = models.TextField()
    # When we suspect the incident actually started
    date_started = models.DateTimeField(default=timezone.now)
    # When we actually detected the incident
    date_detected = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)
    date_closed = models.DateTimeField(null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incident"
        unique_together = (("organization", "identifier"),)
        index_together = (("alert_rule", "type", "status"),)

    @property
    def current_end_date(self):
        """
        Returns the current end of the incident. Either the date it was closed,
        or the current time if it's still open.
        """
        return self.date_closed if self.date_closed else timezone.now()

    @property
    def duration(self):
        return self.current_end_date - self.date_started


class IncidentSnapshot(Model):
    __core__ = True

    incident = models.OneToOneField("sentry.Incident")
    event_stats_snapshot = FlexibleForeignKey("sentry.TimeSeriesSnapshot")
    unique_users = models.IntegerField()
    total_events = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentsnapshot"


class TimeSeriesSnapshot(Model):
    __core__ = True

    start = models.DateTimeField()
    end = models.DateTimeField()
    values = ArrayField(of=ArrayField(models.IntegerField()))
    period = models.IntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_timeseriessnapshot"

    @property
    def snuba_values(self):
        """
        Returns values matching the snuba format, a list of dicts with 'time'
        and 'count' keys.
        :return:
        """
        return {"data": [{"time": time, "count": count} for time, count in self.values]}


class IncidentActivityType(Enum):
    CREATED = 0
    DETECTED = 1
    STATUS_CHANGE = 2
    COMMENT = 3


class IncidentActivity(Model):
    __core__ = True

    incident = FlexibleForeignKey("sentry.Incident")
    user = FlexibleForeignKey("sentry.User", null=True)
    type = models.IntegerField()
    value = models.TextField(null=True)
    previous_value = models.TextField(null=True)
    comment = models.TextField(null=True)
    event_stats_snapshot = FlexibleForeignKey("sentry.TimeSeriesSnapshot", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentactivity"


class IncidentSubscription(Model):
    __core__ = True

    incident = FlexibleForeignKey("sentry.Incident", db_index=False)
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentsubscription"
        unique_together = (("incident", "user"),)

    __repr__ = sane_repr("incident_id", "user_id")


class IncidentSuspectCommit(Model):
    __core__ = True

    incident = FlexibleForeignKey("sentry.Incident", db_index=False)
    commit = FlexibleForeignKey("sentry.Commit", db_constraint=False)
    order = models.SmallIntegerField()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidentsuspectcommit"
        unique_together = (("incident", "commit"),)


class AlertRuleStatus(Enum):
    PENDING = 0
    TRIGGERED = 1
    PENDING_DELETION = 2
    DELETION_IN_PROGRESS = 3


class AlertRuleThresholdType(Enum):
    ABOVE = 0
    BELOW = 1


class AlertRuleManager(BaseManager):
    """
    A manager that excludes all rows that are pending deletion.
    """

    def get_queryset(self):
        return (
            super(AlertRuleManager, self)
            .get_queryset()
            .exclude(
                status__in=(
                    AlertRuleStatus.PENDING_DELETION.value,
                    AlertRuleStatus.DELETION_IN_PROGRESS.value,
                )
            )
        )

    def fetch_for_organization(self, organization):
        return self.filter(organization=organization)

    def fetch_for_project(self, project):
        return self.filter(query_subscriptions__project=project)


class AlertRuleQuerySubscription(Model):
    __core__ = True

    query_subscription = FlexibleForeignKey("sentry.QuerySubscription", unique=True)
    alert_rule = FlexibleForeignKey("sentry.AlertRule")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertrulequerysubscription"


class AlertRuleExcludedProjects(Model):
    __core__ = True

    alert_rule = FlexibleForeignKey("sentry.AlertRule", db_index=False)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruleexcludedprojects"
        unique_together = (("alert_rule", "project"),)


class AlertRule(Model):
    __core__ = True

    objects = AlertRuleManager()
    objects_with_deleted = BaseManager()

    organization = FlexibleForeignKey("sentry.Organization", db_index=False, null=True)
    query_subscriptions = models.ManyToManyField(
        "sentry.QuerySubscription", related_name="alert_rules", through=AlertRuleQuerySubscription
    )
    excluded_projects = models.ManyToManyField(
        "sentry.Project", related_name="alert_rule_exclusions", through=AlertRuleExcludedProjects
    )
    name = models.TextField()
    status = models.SmallIntegerField(default=AlertRuleStatus.PENDING.value)
    dataset = models.TextField()
    query = models.TextField()
    # Determines whether we include all current and future projects from this
    # organization in this rule.
    include_all_projects = models.BooleanField(default=False)
    # TODO: Remove this default after we migrate
    aggregation = models.IntegerField(default=QueryAggregations.TOTAL.value)
    time_window = models.IntegerField()
    resolution = models.IntegerField()
    threshold_period = models.IntegerField()
    date_modified = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertrule"
        unique_together = (("organization", "name"),)


class TriggerStatus(Enum):
    ACTIVE = 0
    RESOLVED = 1


class IncidentTrigger(Model):
    __core__ = True

    incident = FlexibleForeignKey("sentry.Incident", db_index=False)
    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger")
    status = models.SmallIntegerField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_incidenttrigger"
        unique_together = (("incident", "alert_rule_trigger"),)


class AlertRuleTrigger(Model):
    __core__ = True

    alert_rule = FlexibleForeignKey("sentry.AlertRule")
    label = models.TextField()
    threshold_type = models.SmallIntegerField()
    alert_threshold = models.IntegerField()
    resolve_threshold = models.IntegerField(null=True)
    triggered_incidents = models.ManyToManyField(
        "sentry.Incident", related_name="triggers", through=IncidentTrigger
    )
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletrigger"
        unique_together = (("alert_rule", "label"),)


class AlertRuleTriggerExclusion(Model):
    __core__ = True

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger", related_name="exclusions")
    query_subscription = FlexibleForeignKey("sentry.QuerySubscription")
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletriggerexclusion"
        unique_together = (("alert_rule_trigger", "query_subscription"),)


class AlertRuleTriggerAction(Model):
    """
    This model represents an action that occurs when a trigger is fired. This is
    typically some sort of notification.
    """

    __core__ = True

    _type_registrations = {}

    # Which sort of action to take
    class Type(Enum):
        EMAIL = 0
        PAGERDUTY = 1
        SLACK = 2

    class TargetType(Enum):
        # A direct reference, like an email address, Slack channel or PagerDuty service
        SPECIFIC = 0
        # A specific user. This could be used to grab the user's email address.
        USER = 1
        # A specific team. This could be used to send an email to everyone associated
        # with a team.
        TEAM = 2

    TypeRegistration = namedtuple(
        "TypeRegistration",
        ["handler", "slug", "type", "supported_target_types", "integration_provider"],
    )

    alert_rule_trigger = FlexibleForeignKey("sentry.AlertRuleTrigger")
    integration = FlexibleForeignKey("sentry.Integration", null=True)
    type = models.SmallIntegerField()
    target_type = models.SmallIntegerField()
    # Identifier used to perform the action on a given target
    target_identifier = models.TextField(null=True)
    # Human readable name to display in the UI
    target_display = models.TextField(null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_alertruletriggeraction"

    @property
    def target(self):
        if self.target_type == self.TargetType.USER.value:
            try:
                return User.objects.get(id=int(self.target_identifier))
            except User.DoesNotExist:
                pass
        elif self.target_type == self.TargetType.TEAM.value:
            try:
                return Team.objects.get(id=int(self.target_identifier))
            except Team.DoesNotExist:
                pass
        elif self.target_type == self.TargetType.SPECIFIC.value:
            # TODO: This is only for email. We should have a way of validating that it's
            # ok to contact this email.
            return self.target_identifier

    def build_handler(self, incident, project):
        type = AlertRuleTriggerAction.Type(self.type)
        if type in self._type_registrations:
            return self._type_registrations[type].handler(self, incident, project)
        else:
            metrics.incr("alert_rule_trigger.unhandled_type.{}".format(self.type))

    def fire(self, incident, project):
        handler = self.build_handler(incident, project)
        if handler:
            return handler.fire()

    def resolve(self, incident, project):
        handler = self.build_handler(incident, project)
        if handler:
            return handler.resolve()

    @classmethod
    def register_type(cls, slug, type, supported_target_types, integration_provider=None):
        """
        Registers a handler for a given type.
        :param slug: A string representing the name of this type registration
        :param type: The `Type` to handle.
        :param handler: A subclass of `ActionHandler` that accepts the
        `AlertRuleTriggerAction` and `Incident`.
        :param integration_provider: String representing the integration provider
        related to this type.
        """

        def inner(handler):
            if type not in cls._type_registrations:
                cls._type_registrations[type] = cls.TypeRegistration(
                    handler, slug, type, set(supported_target_types), integration_provider
                )
            else:
                raise Exception(u"Handler already registered for type %s" % type)
            return handler

        return inner

    @classmethod
    def get_registered_type(cls, type):
        return cls._type_registrations[type]

    @classmethod
    def get_registered_types(cls):
        return cls._type_registrations.values()
