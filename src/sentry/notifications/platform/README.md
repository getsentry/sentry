# Notification Platform

This module enables Sentry to send standardized notifications across different providers, with rich contents
like images, calls to action, and dynamic links. It does this through a series of data models and concepts which can be heavily customized,
but also provides some opinionated defaults to make it easy to get started.

A quick glossary overview:

- **Notification Service** - the interface to actually send your notifications
- **Notification Data** - the raw data which is necessary for your notification
- **Notification Template** - the class which is responsible for processing your raw Notification Data into a user readable format
- **Notification Rendered Template** - the standardized format all notifications adhere to prior to being sent
- **Notification Provider** - the medium to which a notification is sent (e.g. slack, discord)
- **Notification Provider Renderer** - the adapter to convert templates to provider specific formats (e.g. Slack's BlockKit, HTML for emails)
- **Notification Target** - the intended recipients of a notification
- **Notification Strategy** - a standardized pattern for repeatably creating targets

If you're developing a new feature, and wish to notify a Slack channel, Discord direct message, or just send an email,
refer to the [usage](#usage) instructions ahead. If you're extending the platform, check out [development](#development) instead.

## Usage

For wholly new notifications, you'll have to set up the following:

1. Decide on a `NotificationCategory` (for opt-out) and assign a `NotificationSource` (for logs/metrics) in [types.py](./types.py).
2. Use the above to create a dataclass (following the `NotificationData` protocol in [types.py](./types.py))
3. Create a template (`NotificationTemplate` subclass) to convert your `NotificationData` to a `NotificationRenderedTemplate`.
4. Create targets from the intended recipients (preferably with a `NotificationStrategy`)
5. Import the `NotificationService` into your app code, and call `notify()`!

If you're changing the formatting of an existing notification, just update the loader from Step 3.
If you're sending an existing notification from new code, just import the service from Step 5.

In general, the platform has sensible defaults, and standardized elements to help with consistency across providers and notifications.
If you find yourself needing more customization, a [custom ProviderRenderer](#notificationproviderrenderer) might be helpful, but consider adding the change to all other providers as well.

### Example

<!-- TODO(ecosystem): Add example here -->

## Development

The following are common areas that owners of the NotificationPlatform may need to extend/improve.

### NotificationStrategy

<!-- TODO(ecosystem): Add guidance here -->

### NotificationProviderRenderer

<!-- TODO(ecosystem): Add guidance here -->

### NotificationProvider

A notification provider is the system which Sentry will trigger in order to notify NotificationTargets, for example; Email or Slack.

To register a new provider:

1. Add a key to `NotificationProviderKey` in [`.types`](./types.py)
2. Add a directory for your new provider.
3. Create a provider module in the new directory.
   - Extend `NotificationProvider` from [`.provider`](./provider.py) and implement its methods/variables.
   - Import `provider_registry` from [`.registry`](./registry.py) and add it via decorator: `@provider_registry.register(<YOUR-KEY-HERE>)`
4. In [../apps](../apps.py), explicitly import the module to register the provider on initialization.

### NotificationTemplate

<!-- TODO(ecosystem): Add guidance here -->
