from sentry.scm.private.ipc import produce_to_listener, produce_to_listeners
from sentry.scm.types import HybridCloudSilo, SubscriptionEvent


def publish_subscription_event(event: SubscriptionEvent, silo: HybridCloudSilo) -> None:
    """
    Publish source code management service provider subscription events.

    Messages published to the topic have had their provedence asserted. They are genuine requests
    and can be trusted. Untrusted messages must never be published to this topic. There is no
    gurantee or requirement for down-stream consumers to validate their message's authenticity.
    """
    produce_to_listeners(event, silo, produce_to_listener=produce_to_listener)
