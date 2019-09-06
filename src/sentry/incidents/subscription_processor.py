from __future__ import absolute_import

import logging
import operator
from datetime import timedelta

from django.conf import settings
from django.db import transaction

from sentry.incidents.logic import (
    alert_aggregation_to_snuba,
    create_incident,
    update_incident_status,
)
from sentry.incidents.models import (
    AlertRule,
    AlertRuleAggregations,
    AlertRuleThresholdType,
    Incident,
    IncidentStatus,
    IncidentType,
)
from sentry.utils import metrics, redis
from sentry.utils.dates import to_datetime


logger = logging.getLogger(__name__)
REDIS_TTL = int(timedelta(days=7).total_seconds())
ALERT_RULE_BASE_STAT_KEY = "{alert_rule:%s}:%%s"
ALERT_RULE_STAT_KEYS = ("last_update", "alert_triggered", "resolve_triggered")


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
            self.alert_rule = AlertRule.objects.get(query_subscription=subscription)
        except AlertRule.DoesNotExist:
            return

        self.last_update, self.alert_triggers, self.resolve_triggers = get_alert_rule_stats(
            self.alert_rule
        )
        self.orig_alert_triggers = self.alert_triggers
        self.orig_resolve_triggers = self.resolve_triggers

    @property
    def active_incident(self):
        if not hasattr(self, "_active_incident"):
            try:
                # Fetch the active incident if one exists for this alert rule.
                # TODO: Probably worth adding an index to optimize this, since could
                # potentially be called frequently and could be slow if we have
                # a lot of incidents created by a rule.
                self._active_incident = Incident.objects.filter(
                    type=IncidentType.ALERT_TRIGGERED.value,
                    status=IncidentStatus.OPEN.value,
                    alert_rule=self.alert_rule,
                ).order_by("-date_added")[0]
            except IndexError:
                self._active_incident = None
        return self._active_incident

    @active_incident.setter
    def active_incident(self, active_incident):
        self._active_incident = active_incident

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

        # TODO: At the moment we only have individual aggregations. Handle multiple
        # later
        aggregation = AlertRuleAggregations(self.alert_rule.aggregation)
        aggregation_name = alert_aggregation_to_snuba[aggregation][2]
        aggregation_value = subscription_update["values"][aggregation_name]

        alert_operator, resolve_operator = self.THRESHOLD_TYPE_OPERATORS[
            AlertRuleThresholdType(self.alert_rule.threshold_type)
        ]

        if (
            alert_operator(aggregation_value, self.alert_rule.alert_threshold)
            and not self.active_incident
        ):
            with transaction.atomic():
                self.trigger_alert_threshold()
        elif (
            # TODO: Need to make `resolve_threshold` nullable so that it can be
            # optional
            self.alert_rule.resolve_threshold is not None
            and resolve_operator(aggregation_value, self.alert_rule.resolve_threshold)
            and self.active_incident
        ):
            with transaction.atomic():
                self.trigger_resolve_threshold()
        else:
            self.alert_triggers = 0
            self.resolve_triggers = 0

        # We update the rule stats here after we commit the transaction. This guarantees
        # that we'll never miss an update, since we'll never roll back if the process
        # is killed here. The trade-off is that we might process an update twice. Mostly
        # this will have no effect, but if someone manages to close a triggered incident
        # before the next one then we might alert twice.
        self.update_alert_rule_stats()

    def trigger_alert_threshold(self):
        """
        Called when a subscription update exceeds the value defined in the
        `alert_rule.alert_threshold`, and there is not already an active incident. Increments the
        count of how many times we've consecutively exceeded the threshold, and if
        above the `threshold_period` defined in the alert rule then create an incident.
        :return:
        """
        self.alert_triggers += 1
        if self.alert_triggers >= self.alert_rule.threshold_period:
            detected_at = to_datetime(self.last_update)
            self.active_incident = create_incident(
                self.alert_rule.project.organization,
                IncidentType.ALERT_TRIGGERED,
                # TODO: Include more info in name?
                self.alert_rule.name,
                alert_rule=self.alert_rule,
                # TODO: Incidents need to keep track of which metric to display
                query=self.subscription.query,
                date_started=detected_at,
                date_detected=detected_at,
                projects=[self.alert_rule.project],
            )
            # TODO: We should create an audit log, and maybe something that keeps
            # all of the details available for showing on the incident. Might be a json
            # blob or w/e? Or might be able to use the audit log.

            # We now set this threshold to 0. We don't need to count it anymore
            # once we've triggered an incident.
            self.alert_triggers = 0

    def trigger_resolve_threshold(self):
        """
        Called when a subscription update exceeds the value defined in
        `alert_rule.resolve_threshold` and there's a current active incident.
        :return:
        """
        self.resolve_triggers += 1
        if self.resolve_triggers >= self.alert_rule.threshold_period:
            update_incident_status(self.active_incident, IncidentStatus.CLOSED)
            self.resolve_triggers = 0
            self.active_incident = None

    def update_alert_rule_stats(self):
        """
        Updates stats about the alert rule, if they're changed.
        :return:
        """
        kwargs = {}
        if self.alert_triggers != self.orig_alert_triggers:
            self.orig_alert_triggers = kwargs["alert_triggers"] = self.alert_triggers
        if self.resolve_triggers != self.orig_resolve_triggers:
            self.orig_resolve_trigger = kwargs["resolve_triggers"] = self.resolve_triggers

        update_alert_rule_stats(self.alert_rule, self.last_update, **kwargs)


def build_alert_rule_stat_keys(alert_rule):
    key_base = ALERT_RULE_BASE_STAT_KEY % alert_rule.id
    return [key_base % stat_key for stat_key in ALERT_RULE_STAT_KEYS]


def get_alert_rule_stats(alert_rule):
    """
    Fetches stats about the alert rule
    :return: A tuple containing the stats about the alert rule.
     - last_update: Int representing the timestamp the rule was last updated
     - alert_triggered: Int representing how many consecutive times the rule has
       triggered the alert threshold
     - resolve_triggered: Int representing how many consecutive times the rule has
       triggered the resolve threshold
    """
    results = get_redis_client().mget(build_alert_rule_stat_keys(alert_rule))
    return tuple(0 if result is None else int(result) for result in results)


def update_alert_rule_stats(alert_rule, last_update, alert_triggers=None, resolve_triggers=None):
    """
    Updates stats about the alert rule, if they're changed.
    :return:
    """
    pipeline = get_redis_client().pipeline()
    last_update_key, alert_trigger_key, resolve_trigger_key = build_alert_rule_stat_keys(alert_rule)
    if alert_triggers is not None:
        pipeline.set(alert_trigger_key, alert_triggers, ex=REDIS_TTL)
    if resolve_triggers is not None:
        pipeline.set(resolve_trigger_key, resolve_triggers, ex=REDIS_TTL)

    pipeline.set(last_update_key, last_update, ex=REDIS_TTL)
    pipeline.execute()


def get_redis_client():
    cluster_key = getattr(settings, "SENTRY_INCIDENT_RULES_REDIS_CLUSTER", None)
    if cluster_key is None:
        client = redis.clusters.get("default").get_local_client(0)
    else:
        client = redis.redis_clusters.get(cluster_key)
    return client
