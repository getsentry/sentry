import logging
from collections.abc import Mapping
from typing import Any

from sentry.models.activity import Activity
from sentry.notifications.notifications.activity.assigned import (
    AssignedActivityNotification as BaseAssignedActivityNotification,
)
from sentry.notifications.notifications.activity.base import GroupActivityNotification
from sentry.types.activity import ActivityType
from sentry.utils import metrics

_default_logger = logging.getLogger(__name__)


class AssignedActivityNotification(BaseAssignedActivityNotification):
    """
    This notification overrides the base AssignedActivityNotification text template to remove the explicit issue name,
    and instead leverages "this issue" since this notification is already attached to an existing notification where
    the issue name exists.
    """

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        return "{author} assigned this issue to {assignee}", None, {"assignee": self.get_assignee()}


class _ExternalIssueCreatedActivity:
    """
    Class responsible for helping derive data from a specific activity type
    """

    _NO_PROVIDER_KEY_METRICS = "sentry.integrations.slack.tasks.activity_notifications.external_issue_created_activity.missing_provider"
    _NO_LINK_KEY_METRICS = "sentry.integrations.slack.tasks.activity_notifications.external_issue_created_activity.missing_link"
    _NO_LABEL_KEY_METRICS = "sentry.integrations.slack.tasks.activity_notifications.external_issue_created_activity.missing_label"

    DEFAULT_PROVIDER_FALLBACK_TEXT = "external provider"
    _PROVIDER_KEY = "provider"
    _TICKET_KEY = "label"
    _URL_KEY = "location"

    def __init__(self, activity: Activity) -> None:
        try:
            activity_type: ActivityType = ActivityType(activity.type)
        except ValueError as err:
            _default_logger.info(
                "there was an error trying to get activity type, assuming activity is unsupported",
                exc_info=err,
                extra={
                    "error": str(err),
                    "activity_id": activity.id,
                    "activity_type_raw": activity.type,
                },
            )
            raise

        if activity_type != ActivityType.CREATE_ISSUE:
            _default_logger.info(
                "tried to use external issue creator for an improper activity type",
                extra={
                    "activity_id": activity.id,
                    "activity_type_raw": activity.type,
                    "activity_type": activity_type,
                },
            )

            raise Exception(f"Activity type {activity_type} is incorrect")
        self._activity: Activity = activity

    def get_link(self) -> str:
        """
        Returns the link to where the issue was created in the external provider.
        """
        link = self._activity.data.get(self._URL_KEY, None)
        if not link:
            metrics.incr(
                self._NO_LINK_KEY_METRICS,
                sample_rate=1.0,
            )

            _default_logger.info(
                "Activity does not have a url key, using fallback",
                extra={
                    "activity_id": self._activity.id,
                },
            )
            link = ""
        return link

    def get_provider(self) -> str:
        """
        Returns the provider of the activity for where the issue was created.
        Returns the value in lowercase to provider consistent value.
        If key is not found, or value is empty, uses the fallback value.
        """
        provider = self._activity.data.get(self._PROVIDER_KEY, None)
        if not provider:
            metrics.incr(
                self._NO_PROVIDER_KEY_METRICS,
                sample_rate=1.0,
            )
            _default_logger.info(
                "Activity does not have a provider key, using fallback",
                extra={
                    "activity_id": self._activity.id,
                },
            )
            provider = self.DEFAULT_PROVIDER_FALLBACK_TEXT

        return provider.lower()

    def get_ticket_number(self) -> str:
        """
        Returns the ticket number for the issue that was created on the external provider.
        """
        ticket_number = self._activity.data.get(self._TICKET_KEY, None)
        if not ticket_number:
            metrics.incr(
                self._NO_LABEL_KEY_METRICS,
                sample_rate=1.0,
            )
            _default_logger.info(
                "Activity does not have a label key, using fallback",
                extra={
                    "activity_id": self._activity.id,
                },
            )
            ticket_number = ""

        return ticket_number

    def get_formatted_provider_name(self) -> str:
        # Make sure to make the proper noun have correct capitalization
        # I.e. github -> GitHub, jira -> Jira
        # Special cases like github -> GitHub are implemented in their overriden classes
        return self.get_provider().capitalize()


class _AsanaExternalIssueCreatedActivity(_ExternalIssueCreatedActivity):
    """
    Override class for Asana as, at this time, the label, or ticket number, does not exist and has to be derived.
    If plausible, this could be removed if the activity object itself properly has the correct data, but side effects
    for that change are not yet known.
    """

    _DEFAULT_ASANA_LABEL_VALUE = "Asana Issue"

    def get_ticket_number(self) -> str:
        # Try to use the base logic if it works as a just in-case
        stored_value = super().get_ticket_number()
        if stored_value != "" and stored_value != self._DEFAULT_ASANA_LABEL_VALUE:
            return stored_value

        link = self.get_link()
        if not link:
            return ""

        # Remove any trailing slashes
        if link.endswith("/"):
            link = link[:-1]

        # Split the URL by "/"
        parts = link.split("/")

        # Get the last part
        last_part = parts[-1]

        return last_part


class _GithubExternalIssueCreatedActivity(_ExternalIssueCreatedActivity):
    """
    Override class for Github, as the provider name that we want to display should be GitHub, not "Github"
    """

    def get_formatted_provider_name(self) -> str:
        return "GitHub"


_activity_classes = {
    "asana": _AsanaExternalIssueCreatedActivity,
    "github": _GithubExternalIssueCreatedActivity,
}


def _external_issue_activity_factory(activity: Activity) -> _ExternalIssueCreatedActivity:
    """
    Returns the correct ExternalIssueCreatedActivity class based on the provider.
    All classes have the same interface, the method for one is simply modified for its use case.
    """

    base_activity = _ExternalIssueCreatedActivity(activity=activity)
    provider = base_activity.get_provider()

    ActivityClass = _activity_classes.get(provider, None)
    return ActivityClass(activity=activity) if ActivityClass else base_activity


class ExternalIssueCreatedActivityNotification(GroupActivityNotification):
    metrics_key = "create_issue"
    title = "External Issue Created"

    def get_description(self) -> tuple[str, str | None, Mapping[str, Any]]:
        external_issue = _external_issue_activity_factory(activity=self.activity)

        provider = external_issue.get_provider()
        # Use proper grammar, so use "an" if it's "external provider" and "a" if it's a regular name
        if provider == external_issue.DEFAULT_PROVIDER_FALLBACK_TEXT:
            base_template = "an "
        else:
            base_template = "a "
            provider = external_issue.get_formatted_provider_name()
        base_template += "{provider} issue"

        ticket_number = external_issue.get_ticket_number()
        if ticket_number:
            base_template += " {ticket}"

        link = external_issue.get_link()
        if link:
            base_template = "<{link}|" + base_template + ">"

        # Template should look something like "{author} created <{link}| a/an {provider} issue {ticket}>"
        if self.activity.data.get("new", True):
            base_template = "{author} created " + base_template
        else:
            base_template = "{author} linked " + base_template

        return base_template, None, {"provider": provider, "ticket": ticket_number, "link": link}
