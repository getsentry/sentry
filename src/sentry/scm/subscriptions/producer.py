from sentry.scm.private.ipc import publish_subscription_event as _publish_subscription_event
from sentry.scm.types import SubscriptionEvent


def publish_subscription_event(event: SubscriptionEvent) -> None:
    """
    Publish source code management service provider subscription events.

    Messages published to the topic have had their provedence asserted. They are genuine requests
    and can be trusted. Untrusted messages must never be published to this topic. There is no
    gurantee or requirement for down-stream consumers to validate their message's authenticity.
    """
    _publish_subscription_event(event)
