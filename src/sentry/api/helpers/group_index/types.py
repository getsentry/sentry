from typing import Annotated, NotRequired, TypedDict

from sentry.api.helpers.group_index.validators.status_details import StatusDetailsResult
from sentry.api.serializers.models.actor import ActorSerializerResponse
from sentry.apidocs.descriptions import ApiDescription
from sentry.issues.merge import MergedGroup
from sentry.notifications.helpers import SubscriptionDetails


# This type isn't being enforced, but is necessary to publish the API.
# This shape is currently assembled by the `update_groups` function.
class MutateIssueResponse(TypedDict):
    assignedTo: NotRequired[
        Annotated[
            ActorSerializerResponse, ApiDescription("User or team the issues are now assigned to")
        ]
    ]
    discard: NotRequired[Annotated[bool, ApiDescription("Whether the issues were discarded")]]
    hasSeen: NotRequired[
        Annotated[bool, ApiDescription("Whether the requesting user has now seen the issues")]
    ]
    inbox: NotRequired[Annotated[bool, ApiDescription("Whether the issues are now in the inbox")]]
    isBookmarked: NotRequired[
        Annotated[bool, ApiDescription("Whether the requesting user has now bookmarked the issues")]
    ]
    isPublic: NotRequired[
        Annotated[bool, ApiDescription("Whether the issues are now shared publicly")]
    ]
    isSubscribed: NotRequired[
        Annotated[
            bool, ApiDescription("Whether the requesting user is now subscribed to the issues")
        ]
    ]
    merge: NotRequired[
        Annotated[
            MergedGroup,
            ApiDescription(
                "Result of merging the issues: the issue they were merged into and the merged issues"
            ),
        ]
    ]
    priority: NotRequired[
        Annotated[str, ApiDescription("New priority of the issues: high, medium or low")]
    ]
    shareId: NotRequired[
        Annotated[
            str, ApiDescription("ID used in the public share URL. Set when the issue is now shared")
        ]
    ]
    status: NotRequired[Annotated[str, ApiDescription("New status of the issues")]]
    statusDetails: NotRequired[
        Annotated[
            StatusDetailsResult,
            ApiDescription(
                "Details of the new status, such as the release that resolves the issues or when an ignore expires"
            ),
        ]
    ]
    subscriptionDetails: NotRequired[
        Annotated[
            SubscriptionDetails,
            ApiDescription("Why the requesting user is now subscribed to the issues"),
        ]
    ]
    substatus: NotRequired[
        Annotated[
            str,
            ApiDescription(
                "New substatus of the issues, such as ongoing or archived_until_escalating"
            ),
        ]
    ]
