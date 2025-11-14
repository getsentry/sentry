from typing import NotRequired, TypedDict, int

from sentry.api.helpers.group_index.validators.status_details import StatusDetailsResult
from sentry.api.serializers.models.actor import ActorSerializerResponse
from sentry.issues.merge import MergedGroup
from sentry.notifications.helpers import SubscriptionDetails


# This type isn't being enforced, but is necessary to publish the API.
# This shape is currently assembled by the `update_groups` function.
class MutateIssueResponse(TypedDict):
    assignedTo: NotRequired[ActorSerializerResponse]
    discard: NotRequired[bool]
    hasSeen: NotRequired[bool]
    inbox: NotRequired[bool]
    isBookmarked: NotRequired[bool]
    isPublic: NotRequired[bool]
    isSubscribed: NotRequired[bool]
    merge: NotRequired[MergedGroup]
    priority: NotRequired[str]
    shareId: NotRequired[str]
    status: NotRequired[str]
    statusDetails: NotRequired[StatusDetailsResult]
    subscriptionDetails: NotRequired[SubscriptionDetails]
    substatus: NotRequired[str]
