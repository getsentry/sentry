from typing import int
"""
The repository classes are responsible for the interactions with the data store for the NotificationMessage data model.
The classes help separate the query interface with the actual data store for the NotificationMessage data model.

If we scale quickly, the current NotificationMessage data model will have to shift from django postgres to
snuba clickhouse, and these classes will help keep the changes consolidated to here.
For self-hosted, if the user wants to utilize another datastore, they are able to do so.

What we query from an interface level won't change, simply how we query will change, and these classes should be the
only thing that need to change after we make the migration.
"""

import functools

from sentry.integrations.repository.issue_alert import IssueAlertNotificationMessageRepository
from sentry.integrations.repository.metric_alert import MetricAlertNotificationMessageRepository
from sentry.integrations.repository.notification_action import (
    NotificationActionNotificationMessageRepository,
)


@functools.cache
def get_default_metric_alert_repository() -> MetricAlertNotificationMessageRepository:
    return MetricAlertNotificationMessageRepository.default()


@functools.cache
def get_default_issue_alert_repository() -> IssueAlertNotificationMessageRepository:
    return IssueAlertNotificationMessageRepository.default()


@functools.cache
def get_default_notification_action_repository() -> NotificationActionNotificationMessageRepository:
    return NotificationActionNotificationMessageRepository.default()
