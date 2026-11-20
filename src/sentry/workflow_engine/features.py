from sentry import features
from sentry.models.organization import Organization


def is_activity_workflow_enabled(organization: Organization) -> bool:
    """Shared routing decision for activity processing, producers, and Inbox cutover.

    Keep this independent of Inbox recording and UI availability.
    """
    return bool(features.has("organizations:workflow-engine-activity-workflows", organization))
