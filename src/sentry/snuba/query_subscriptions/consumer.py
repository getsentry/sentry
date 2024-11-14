import logging
from collections.abc import Callable
from datetime import timezone

import sentry_sdk
from dateutil.parser import parse as parse_date
from sentry_kafka_schemas.codecs import Codec, ValidationError
from sentry_kafka_schemas.schema_types.events_subscription_results_v1 import SubscriptionResult

from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.snuba.dataset import EntityKey
from sentry.snuba.models import QuerySubscription
from sentry.snuba.query_subscriptions.constants import topic_to_dataset
from sentry.snuba.tasks import _delete_from_snuba
from sentry.utils import metrics

logger = logging.getLogger(__name__)
TQuerySubscriptionCallable = Callable[[QuerySubscriptionUpdate, QuerySubscription], None]

subscriber_registry: dict[str, TQuerySubscriptionCallable] = {}


def register_subscriber(
    subscriber_key: str,
) -> Callable[[TQuerySubscriptionCallable], TQuerySubscriptionCallable]:
    def inner(func: TQuerySubscriptionCallable) -> TQuerySubscriptionCallable:
        if subscriber_key in subscriber_registry:
            raise Exception("Handler already registered for %s" % subscriber_key)
        subscriber_registry[subscriber_key] = func
        return func

    return inner


def parse_message_value(
    value: bytes, jsoncodec: Codec[SubscriptionResult]
) -> QuerySubscriptionUpdate:
    """
    Parses the value received via the Kafka consumer and verifies that it
    matches the expected schema.
    :param value: A json formatted string
    :return: A dict with the parsed message
    """
    with metrics.timer("snuba_query_subscriber.parse_message_value.json_validate_wrapper"):
        try:
            wrapper = jsoncodec.decode(value, validate=True)
        except ValidationError:
            metrics.incr("snuba_query_subscriber.message_wrapper_invalid")
            raise InvalidSchemaError("Message wrapper does not match schema")

    payload = wrapper["payload"]
    # XXX: Since we just return the raw dict here, when the payload changes it'll
    # break things. This should convert the payload into a class rather than passing
    # the dict around, but until we get time to refactor we can keep things working
    # here.
    return {
        "entity": payload["entity"],
        "subscription_id": payload["subscription_id"],
        "values": payload["result"],
        "timestamp": parse_date(payload["timestamp"]).replace(tzinfo=timezone.utc),
    }


def handle_message(
    message_value: bytes,
    message_offset: int,
    message_partition: int,
    topic: str,
    dataset: str,
    jsoncodec: Codec[SubscriptionResult],
) -> None:
    """
    Parses the value from Kafka, and if valid passes the payload to the callback defined by the
    subscription. If the subscription has been removed, or no longer has a valid callback then
    just log metrics/errors and continue.
    :param message:
    :return:
    """
    with sentry_sdk.isolation_scope() as scope:
        try:
            with metrics.timer(
                "snuba_query_subscriber.parse_message_value", tags={"dataset": dataset}
            ):
                contents = parse_message_value(message_value, jsoncodec)
        except InvalidMessageError:
            # If the message is in an invalid format, just log the error
            # and continue
            logger.exception(
                "Subscription update could not be parsed",
                extra={
                    "offset": message_offset,
                    "partition": message_partition,
                    "value": message_value,
                },
            )
            return
        scope.set_tag("query_subscription_id", contents["subscription_id"])

        try:
            with metrics.timer(
                "snuba_query_subscriber.fetch_subscription", tags={"dataset": dataset}
            ):
                subscription = QuerySubscription.objects.get_from_cache(
                    subscription_id=contents["subscription_id"]
                )
                if subscription.status != QuerySubscription.Status.ACTIVE.value:
                    metrics.incr("snuba_query_subscriber.subscription_inactive")
                    return
        except QuerySubscription.DoesNotExist:
            metrics.incr(
                "snuba_query_subscriber.subscription_doesnt_exist", tags={"dataset": dataset}
            )
            logger.warning(
                "Received subscription update, but subscription does not exist",
                extra={
                    "offset": message_offset,
                    "partition": message_partition,
                    "value": message_value,
                },
            )
            try:
                if topic in topic_to_dataset:
                    _delete_from_snuba(
                        topic_to_dataset[topic],
                        contents["subscription_id"],
                        EntityKey(contents["entity"]),
                    )
                else:
                    logger.exception(
                        "Topic not registered with QuerySubscriptionConsumer, can't remove "
                        "non-existent subscription from Snuba",
                        extra={"topic": topic, "subscription_id": contents["subscription_id"]},
                    )
            except InvalidMessageError as e:
                logger.exception(str(e))
            except Exception:
                logger.exception("Failed to delete unused subscription from snuba.")
            return

        if subscription.snuba_query is None:
            metrics.incr("snuba_query_subscriber.subscription_snuba_query_missing")
            return

        if subscription.type not in subscriber_registry:
            metrics.incr(
                "snuba_query_subscriber.subscription_type_not_registered", tags={"dataset": dataset}
            )
            logger.error(
                "Received subscription update, but no subscription handler registered",
                extra={
                    "offset": message_offset,
                    "partition": message_partition,
                    "value": message_value,
                },
            )
            return

        sentry_sdk.set_tag("project_id", subscription.project_id)
        sentry_sdk.set_tag("query_subscription_id", contents["subscription_id"])

        callback = subscriber_registry[subscription.type]
        with (
            sentry_sdk.start_span(op="process_message") as span,
            metrics.timer(
                "snuba_query_subscriber.callback.duration",
                instance=subscription.type,
                tags={"dataset": dataset},
            ),
        ):
            span.set_data("payload", contents)
            span.set_data("subscription_dataset", subscription.snuba_query.dataset)
            span.set_data("subscription_query", subscription.snuba_query.query)
            span.set_data("subscription_aggregation", subscription.snuba_query.aggregate)
            span.set_data("subscription_time_window", subscription.snuba_query.time_window)
            span.set_data("subscription_resolution", subscription.snuba_query.resolution)
            span.set_data("message_offset", message_offset)
            span.set_data("message_partition", message_partition)
            span.set_data("message_value", message_value)

            callback(contents, subscription)


class InvalidMessageError(Exception):
    pass


class InvalidSchemaError(InvalidMessageError):
    pass
