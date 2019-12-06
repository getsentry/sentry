from __future__ import absolute_import

import logging
import operator
from copy import deepcopy
from datetime import timedelta
from itertools import izip

from django.conf import settings
from django.db import transaction

from sentry.incidents.logic import create_incident, update_incident_status
from sentry.snuba.subscriptions import query_aggregation_to_snuba
from sentry.incidents.models import (
    AlertRule,
    AlertRuleThresholdType,
    Incident,
    IncidentStatus,
    IncidentTrigger,
    IncidentType,
    TriggerStatus,
)
from sentry.incidents.tasks import handle_trigger_action
from sentry.snuba.models import QueryAggregations
from sentry.utils import metrics, redis
from sentry.utils.dates import to_datetime


logger = logging.getLogger(__name__)
REDIS_TTL = int(timedelta(days=7).total_seconds())
ALERT_RULE_BASE_KEY = "{alert_rule:%s:project:%s}"
ALERT_RULE_BASE_STAT_KEY = "%s:%s"
ALERT_RULE_STAT_KEYS = ("last_update",)
ALERT_RULE_BASE_TRIGGER_STAT_KEY = "%s:trigger:%s:%s"
ALERT_RULE_TRIGGER_STAT_KEYS = ("alert_triggered", "resolve_triggered")


class SubscriptionProcessor(object):
    """
    Class for processing subscription updates for an alert rule. Accepts a subscription
    and then can process one or more updates via `process_update`. Keeps track of how
    close an alert rule is to alerting, creates an incident, and auto resolves the
    incident if a resolve threshold is set and the threshold is triggered.
    """

    # Each entry is a tuple in format (<alert_operator>, <resolve_operator>)
    THRESHOLD_TYPE_OPERATORS = {
        AlertRuleThresholdType.ABOVE: (operator.gt, operator.lt),
        AlertRuleThresholdType.BELOW: (operator.lt, operator.gt),
    }

    def __init__(self, subscription):
        self.subscription = subscription
        try:
            self.alert_rule = AlertRule.objects.get(query_subscriptions=subscription)
        except AlertRule.DoesNotExist:
            return

        self.triggers = list(self.alert_rule.alertruletrigger_set.all().order_by("alert_threshold"))

        self.last_update, self.trigger_alert_counts, self.trigger_resolve_counts = get_alert_rule_stats(
            self.alert_rule, self.subscription, self.triggers
        )
        self.orig_trigger_alert_counts = deepcopy(self.trigger_alert_counts)
        self.orig_trigger_resolve_counts = deepcopy(self.trigger_resolve_counts)

    @property
    def active_incident(self):
        if not hasattr(self, "_active_incident"):
            try:
                # Fetch the active incident if one exists for this alert rule.
                self._active_incident = Incident.objects.filter(
                    type=IncidentType.ALERT_TRIGGERED.value,
                    status=IncidentStatus.OPEN.value,
                    alert_rule=self.alert_rule,
                    projects=self.subscription.project,
                ).order_by("-date_added")[0]
            except IndexError:
                self._active_incident = None
        return self._active_incident

    @active_incident.setter
    def active_incident(self, active_incident):
        self._active_incident = active_incident

    @property
    def incident_triggers(self):
        if not hasattr(self, "_incident_triggers"):
            incident = self.active_incident
            incident_triggers = {}
            if incident:
                # Fetch any existing triggers for the rule
                triggers = IncidentTrigger.objects.filter(incident=incident).select_related(
                    "alert_rule_trigger"
                )
                incident_triggers = {trigger.alert_rule_trigger_id: trigger for trigger in triggers}
            self._incident_triggers = incident_triggers
        return self._incident_triggers

    def check_trigger_status(self, trigger, status):
        """
        Determines whether a trigger is currently at the specified status
        :param trigger: An `AlertRuleTrigger`
        :param status: A `TriggerStatus`
        :return: True if at the specified status, otherwise False
        """
        incident_trigger = self.incident_triggers.get(trigger.id)
        return incident_trigger is not None and incident_trigger.status == status.value

    def process_update(self, subscription_update):
        if not hasattr(self, "alert_rule"):
            # If the alert rule has been removed then just skip
            metrics.incr("incidents.alert_rules.no_alert_rule_for_subscription")
            logger.error(
                "Received an update for a subscription, but no associated alert rule exists"
            )
            # TODO: Delete subscription here.
            return

        if subscription_update["timestamp"] <= self.last_update:
            metrics.incr("incidents.alert_rules.skipping_already_processed_update")
            return

        self.last_update = subscription_update["timestamp"]

        aggregation = QueryAggregations(self.alert_rule.aggregation)
        aggregation_name = query_aggregation_to_snuba[aggregation][2]
        aggregation_value = subscription_update["values"][aggregation_name]

        for trigger in self.triggers:
            alert_operator, resolve_operator = self.THRESHOLD_TYPE_OPERATORS[
                AlertRuleThresholdType(trigger.threshold_type)
            ]

            if alert_operator(
                aggregation_value, trigger.alert_threshold
            ) and not self.check_trigger_status(trigger, TriggerStatus.ACTIVE):
                with transaction.atomic():
                    self.trigger_alert_threshold(trigger)
            elif (
                trigger.resolve_threshold is not None
                and resolve_operator(aggregation_value, trigger.resolve_threshold)
                and self.check_trigger_status(trigger, TriggerStatus.ACTIVE)
            ):
                with transaction.atomic():
                    self.trigger_resolve_threshold(trigger)
            else:
                self.trigger_alert_counts[trigger.id] = 0
                self.trigger_resolve_counts[trigger.id] = 0

        # We update the rule stats here after we commit the transaction. This guarantees
        # that we'll never miss an update, since we'll never roll back if the process
        # is killed here. The trade-off is that we might process an update twice. Mostly
        # this will have no effect, but if someone manages to close a triggered incident
        # before the next one then we might alert twice.
        self.update_alert_rule_stats()

    def trigger_alert_threshold(self, trigger):
        """
        Called when a subscription update exceeds the value defined in the
        `trigger.alert_threshold`, and the trigger hasn't already been activated.
        Increments the count of how many times we've consecutively exceeded the threshold, and if
        above the `threshold_period` defined in the alert rule then mark the trigger as
        activated, and create an incident if there isn't already one.
        :return:
        """
        self.trigger_alert_counts[trigger.id] += 1
        if self.trigger_alert_counts[trigger.id] >= self.alert_rule.threshold_period:
            # Only create a new incident if we don't already have an active one
            if not self.active_incident:
                detected_at = to_datetime(self.last_update)
                self.active_incident = create_incident(
                    self.alert_rule.organization,
                    IncidentType.ALERT_TRIGGERED,
                    # TODO: Include more info in name?
                    self.alert_rule.name,
                    alert_rule=self.alert_rule,
                    query=self.subscription.query,
                    aggregation=QueryAggregations(self.alert_rule.aggregation),
                    date_started=detected_at,
                    date_detected=detected_at,
                    projects=[self.subscription.project],
                )
            # Now create (or update if it already exists) the incident trigger so that
            # we have a record of this trigger firing for this incident
            incident_trigger = self.incident_triggers.get(trigger.id)
            if incident_trigger:
                incident_trigger.status = TriggerStatus.ACTIVE.value
                incident_trigger.save()
            else:
                incident_trigger = IncidentTrigger.objects.create(
                    incident=self.active_incident,
                    alert_rule_trigger=trigger,
                    status=TriggerStatus.ACTIVE.value,
                )
            self.handle_trigger_actions(incident_trigger)
            self.incident_triggers[trigger.id] = incident_trigger

            # TODO: We should create an audit log, and maybe something that keeps
            # all of the details available for showing on the incident. Might be a json
            # blob or w/e? Or might be able to use the audit log

            # We now set this threshold to 0. We don't need to count it anymore
            # once we've triggered an incident.
            self.trigger_alert_counts[trigger.id] = 0

    def check_triggers_resolved(self):
        """
        Determines whether all triggers associated with the active incident are
        resolved. A trigger is considered resolved if it either has no resolve
        threshold, or is in the `TriggerStatus.Resolved` state.
        :return:
        """
        for incident_trigger in self.incident_triggers.values():
            if (
                incident_trigger.alert_rule_trigger.resolve_threshold is not None
                and incident_trigger.status != TriggerStatus.RESOLVED.value
            ):
                return False
        return True

    def trigger_resolve_threshold(self, trigger):
        """
        Called when a subscription update exceeds the value defined in
        `trigger.resolve_threshold` and the trigger is currently ACTIVE.
        :return:
        """
        self.trigger_resolve_counts[trigger.id] += 1
        if self.trigger_resolve_counts[trigger.id] >= self.alert_rule.threshold_period:
            incident_trigger = self.incident_triggers[trigger.id]
            incident_trigger.status = TriggerStatus.RESOLVED.value
            incident_trigger.save()
            self.handle_trigger_actions(incident_trigger)

            if self.check_triggers_resolved():
                update_incident_status(self.active_incident, IncidentStatus.CLOSED)
                self.active_incident = None
                self.incident_triggers.clear()
            self.trigger_resolve_counts[trigger.id] = 0

    def handle_trigger_actions(self, incident_trigger):
        method = "fire" if incident_trigger.status == TriggerStatus.ACTIVE.value else "resolve"

        for action in incident_trigger.alert_rule_trigger.alertruletriggeraction_set.all():
            handle_trigger_action.apply_async(
                kwargs={
                    "action_id": action.id,
                    "incident_id": incident_trigger.incident_id,
                    "project_id": self.subscription.project_id,
                    "method": method,
                },
                countdown=5,
            )

    def update_alert_rule_stats(self):
        """
        Updates stats about the alert rule, if they're changed.
        :return:
        """
        updated_trigger_alert_counts = {
            trigger_id: alert_count
            for trigger_id, alert_count in self.trigger_alert_counts.items()
            if alert_count != self.orig_trigger_alert_counts[trigger_id]
        }
        updated_trigger_resolve_counts = {
            trigger_id: resolve_count
            for trigger_id, resolve_count in self.trigger_resolve_counts.items()
            if resolve_count != self.orig_trigger_resolve_counts[trigger_id]
        }

        update_alert_rule_stats(
            self.alert_rule,
            self.subscription,
            self.last_update,
            updated_trigger_alert_counts,
            updated_trigger_resolve_counts,
        )


def build_alert_rule_stat_keys(alert_rule, subscription):
    """
    Builds keys for fetching stats about alert rules
    :return: A list containing the alert rule stat keys
    """
    key_base = ALERT_RULE_BASE_KEY % (alert_rule.id, subscription.project_id)
    return [ALERT_RULE_BASE_STAT_KEY % (key_base, stat_key) for stat_key in ALERT_RULE_STAT_KEYS]


def build_trigger_stat_keys(alert_rule, subscription, triggers):
    """
    Builds keys for fetching stats about triggers
    :return: A list containing the alert rule trigger stat keys
    """
    return [
        build_alert_rule_trigger_stat_key(
            alert_rule.id, subscription.project_id, trigger.id, stat_key
        )
        for trigger in triggers
        for stat_key in ALERT_RULE_TRIGGER_STAT_KEYS
    ]


def build_alert_rule_trigger_stat_key(alert_rule_id, project_id, trigger_id, stat_key):
    key_base = ALERT_RULE_BASE_KEY % (alert_rule_id, project_id)
    return ALERT_RULE_BASE_TRIGGER_STAT_KEY % (key_base, trigger_id, stat_key)


def partition(iterable, n):
    """
    Partitions an iterable into tuples of size n. Expects the iterable length to be a
    multiple of n.
    partition('ABCDEF', 3) --> [('ABC', 'DEF')]
    """
    assert len(iterable) % n == 0
    args = [iter(iterable)] * n
    return izip(*args)


def get_alert_rule_stats(alert_rule, subscription, triggers):
    """
    Fetches stats about the alert rule, specific to the current subscription
    :return: A tuple containing the stats about the alert rule and subscription.
     - last_update: Int representing the timestamp it was last updated
     - trigger_alert_counts: A dict of trigger alert counts, where the key is the
       trigger id, and the value is an int representing how many consecutive times we
       have triggered the alert threshold
     - trigger_resolve_counts: A dict of trigger resolve counts, where the key is the
       trigger id, and the value is an int representing how many consecutive times we
       have triggered the resolve threshold
    """

    alert_rule_keys = build_alert_rule_stat_keys(alert_rule, subscription)
    trigger_keys = build_trigger_stat_keys(alert_rule, subscription, triggers)
    results = get_redis_client().mget(alert_rule_keys + trigger_keys)
    results = tuple(0 if result is None else int(result) for result in results)
    last_update = results[0]
    trigger_results = results[1:]
    trigger_alert_counts = {}
    trigger_resolve_counts = {}
    for trigger, trigger_result in zip(
        triggers, partition(trigger_results, len(ALERT_RULE_TRIGGER_STAT_KEYS))
    ):
        trigger_alert_counts[trigger.id] = trigger_result[0]
        trigger_resolve_counts[trigger.id] = trigger_result[1]

    return last_update, trigger_alert_counts, trigger_resolve_counts


def update_alert_rule_stats(alert_rule, subscription, last_update, alert_counts, resolve_counts):
    """
    Updates stats about the alert rule, subscription and triggers if they've changed.
    """
    pipeline = get_redis_client().pipeline()

    counts_with_stat_keys = zip(ALERT_RULE_TRIGGER_STAT_KEYS, (alert_counts, resolve_counts))
    for stat_key, trigger_counts in counts_with_stat_keys:
        for trigger_id, alert_count in trigger_counts.items():
            pipeline.set(
                build_alert_rule_trigger_stat_key(
                    alert_rule.id, subscription.project_id, trigger_id, stat_key
                ),
                alert_count,
                ex=REDIS_TTL,
            )

    last_update_key = build_alert_rule_stat_keys(alert_rule, subscription)[0]
    pipeline.set(last_update_key, last_update, ex=REDIS_TTL)
    pipeline.execute()


def get_redis_client():
    cluster_key = getattr(settings, "SENTRY_INCIDENT_RULES_REDIS_CLUSTER", None)
    if cluster_key is None:
        client = redis.clusters.get("default").get_local_client(0)
    else:
        client = redis.redis_clusters.get(cluster_key)
    return client
