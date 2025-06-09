# Notification Platform

TODO(ecosystem): Fill this out

## NotificationProvider

A notification provider is the system which Sentry will trigger in order to notify NotificationTargets, for example; Email or Slack.

To register a new provider:

1. Add a new `NotificationProviderKey` in `sentry.notifications.platform.providers.base`
2. Create a provider module in `/providers`
   - Extend `NotificationProvider` from `sentry.notifications.platform.providers.base`
   - Implement `key` and `is_available()` for your new provider
   - Register it via the decorator `@provider_registry.register(<YOUR-KEY-HERE>)`
3. Add it to the `sentry.notifications.platform.providers` module via `__init__.py`
   - Doing so will allow the django app from `./apps.py` to load your module and register the provider
