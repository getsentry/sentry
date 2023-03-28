# Notification Actions

## Background

Notification Actions are meant to be a generic abstraction of the actions we fire when alert rules go off.
The structure of the model for `NotificationAction` was abstracted from `AlertRuleTriggerAction` but decouples it from issues/events/incidents.
Instead, they are meant to help send notifications to third-party integrations rather than individual channels such as email, or personal notifications settings. These notifications can be configured across the whole organization/project, rather than per recipient. It was originally designed for Spike Protection, but should be generic enough to apply to any other part of Sentry.

Some examples of possible notification actions:
- Receiving audit log entries to a slack channel
- Creating jira tickets from new user feedback items
- Triggering a GitHub notification whenever a release is created in Sentry
- Sending quota notifications or billing updates to a specific non-user email
- Project notifications send to a slack channel instead of the teams/members

## How they work

Notification Actions all rely on a few things:
   1. Triggers - the source of the notification (i.e. what happened in Sentry that caused the notification)
   2. Services - the delivery mechanism (e.g. Slack, PagerDuty, MSTeams, Sentry Notifications, etc.)
   3. Targets - the type of recipeint for the notification. (i.e. is the recipient a user, a team, or specific to the integration)
   4. Registrations - the `ActionRegistration` subclass which helps setup new actions

## Setting up new triggers, services, or targets

If you need to setup new types of triggers, services or targets, you can do so by extending the relevant enums in the `notificationaction.py`.
Services and Targets can only be extended by modifying these enums. There are a few triggers that exist in getsentry, which require modifying the
`GetsentryTriggerAction` enum in that repository.

## Setting up new registrations

The registration classes can be set up via the decorator:

```python
@NotificationAction.register_action(
    trigger_type=ActionTrigger.AUDIT_LOG.value,
    service_type=ActionService.SENTRY_NOTIFICATION.value,
    target_type=ActionTarget.SPECIFIC.value,
)
class SentryAuditLogRegistration(ActionRegistration)
```

The registration methods are initialized to the following (when they inherit from `ActionRegistration`).

 - `fire()` is where you should write the logic for talking to the service, and it must be specified for each registration.
 - `validate_action()` will be invoked when validating new actions. If your action requires unique validation (on top of database integrity checks) this is where you can do so.
 - `serialize_available()` will be invoked to serialize the availability of your action to the frontend. This allows the app to hit one endpoint for all available actions rather than querying across the resources it may take to determine if your action is available.

```python
class SentryAuditLogRegistration(ActionRegistration):
    def fire(self, data: Any) -> None:
        pass

    @classmethod
    def validate_action(cls, data: NotificationActionInputData) -> None:
        pass

    @classmethod
    def serialize_available(
        cls, organization: Organization, integrations: List[RpcIntegration] = None
    ) -> List[JSONData]:
        return []
```
