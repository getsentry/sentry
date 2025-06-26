# Notification Platform

TODO(ecosystem): Fill this out

## NotificationProvider

A notification provider is the system which Sentry will trigger in order to notify NotificationTargets, for example; Email or Slack.

To register a new provider:

1. Add a key to `NotificationProviderKey` in [`.types`](./types.py)
2. Add a directory for your new provider.
3. Create a provider module in the new directory.
   - Extend `NotificationProvider` from [`.provider`](./provider.py) and implement its methods/variables.
   - Import `provider_registry` from [`.registry`](./registry.py) and add it via decorator: `@provider_registry.register(<YOUR-KEY-HERE>)`
4. In [../apps](../apps.py), explicitly import the module to register the provider on initialization.
