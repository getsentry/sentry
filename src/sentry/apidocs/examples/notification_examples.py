from drf_spectacular.utils import OpenApiExample

notification_action_one = {
    "id": "836501735",
    "organizationId": "62848264",
    "serviceType": "sentry_notification",
    "targetDisplay": "default",
    "targetIdentifier": "default",
    "targetType": "specific",
    "triggerType": "spike-protection",
    "projects": [4505321021243392],
}

notification_action_two = {
    "id": "73847650",
    "organizationId": "62848264",
    "serviceType": "sentry_notification",
    "targetDisplay": "default",
    "targetIdentifier": "default",
    "targetType": "specific",
    "triggerType": "spike-protection",
    "projects": [2234153],
}


class NotificationActionExamples:
    CREATE_NOTIFICATION_ACTION = [
        OpenApiExample(
            "Create a new email spike protection notification action for a project",
            value=notification_action_one,
            status_codes=["201"],
            response_only=True,
        )
    ]

    GET_NOTIFICATION_ACTION = [
        OpenApiExample(
            "Retrieve a spike protection notification action created for a project",
            value=notification_action_one,
            status_codes=["200"],
            response_only=True,
        )
    ]

    LIST_NOTIFICATION_ACTIONS = [
        OpenApiExample(
            "List all spike protection notification actions for an organization",
            value=[notification_action_one, notification_action_two],
            status_codes=["201"],
            response_only=True,
        )
    ]

    UPDATE_NOTIFICATION_ACTION = [
        OpenApiExample(
            "Update a spike protection notification action created for a project to use sentry_notification as notification service.",
            value=notification_action_one,
            status_codes=["202"],
            response_only=True,
        )
    ]
