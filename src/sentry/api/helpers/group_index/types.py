from typing import Any, TypedDict

from sentry.api.serializers.models.actor import ActorSerializerResponse
from sentry.issues.merge import MergedGroup
from sentry.notifications.helpers import SubscriptionDetails


# This type isn't being enforced, but is necessary to publish the API.
# This shape is currently assembled by the `update_groups` function.
class MutateIssueResponse(TypedDict):
    assignedTo: ActorSerializerResponse | None
    discard: bool | None
    hasSeen: bool | None
    inbox: bool | None
    isBookmarked: bool | None
    isPublic: bool | None
    isSubscribed: bool | None
    merge: MergedGroup | None
    priority: str | None
    shareId: str | None
    status: str | None
    statusDetails: dict[str, Any] | None
    subscriptionDetails: SubscriptionDetails | None
    substatus: str | None
