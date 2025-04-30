from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, TypeVar

from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.db.models import Model
from redis.client import StrictRedis
from rest_framework import status
from rest_framework.exceptions import APIException

from sentry.db.postgres.transactions import enforce_constraints
from sentry.types.region import RegionContextError, get_local_region

if TYPE_CHECKING:
    from sentry.db.models.base import Model as BaseModel

_TTL = timedelta(minutes=5)

_snowflake_models: set[str] = set()

ModelT = TypeVar("ModelT", bound=Model)


def snowflake_id_model(model_class: type[ModelT]) -> type[ModelT]:
    """
    Decorator to register a model as using snowflake ids
    This decorator informs safety and model consistency checks.
    """
    name = f"{model_class.__module__}.{model_class.__name__}"
    _snowflake_models.add(name)

    return model_class


def uses_snowflake_id(model_class: type[ModelT]) -> bool:
    """
    Check if a model class has been annotated as a snowflake id model
    """
    name = f"{model_class.__module__}.{model_class.__name__}"
    return name in _snowflake_models


def save_with_snowflake_id(
    instance: BaseModel, snowflake_redis_key: str, save_callback: Callable[[], object]
) -> None:
    assert uses_snowflake_id(
        instance.__class__
    ), "Only models decorated with uses_snowflake_id can be saved with save_with_snowflake_id()"

    for _ in range(settings.MAX_REDIS_SNOWFLAKE_RETRY_COUNTER):
        if not instance.id:
            instance.id = generate_snowflake_id(snowflake_redis_key)
        try:
            with enforce_constraints(transaction.atomic(using=router.db_for_write(type(instance)))):
                save_callback()
            return
        except IntegrityError:
            instance.id = None  # type: ignore[assignment]  # see typeddjango/django-stubs#2014
    raise MaxSnowflakeRetryError


class MaxSnowflakeRetryError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Max allowed ID retry reached. Please try again in a second"


@dataclass(frozen=True, eq=True)
class SnowflakeBitSegment:
    length: int
    name: str

    def __post_init__(self) -> None:
        if self.length <= 0:
            raise Exception("The length should be a positive number")

    def validate(self, value: int) -> None:
        if value >> self.length != 0:
            raise Exception(f"{self.name} exceed max bit value of {self.length}")


BIT_SEGMENT_SCHEMA = (
    VERSION_ID := SnowflakeBitSegment(5, "Version ID"),
    TIME_DIFFERENCE := SnowflakeBitSegment(32, "Time difference"),
    REGION_ID := SnowflakeBitSegment(12, "Region ID"),
    REGION_SEQUENCE := SnowflakeBitSegment(4, "Region sequence"),
)

ID_VALIDATOR = SnowflakeBitSegment(
    sum(segment.length for segment in BIT_SEGMENT_SCHEMA), "Snowflake ID"
)
assert ID_VALIDATOR.length == 53

MAX_AVAILABLE_REGION_SEQUENCES = 1 << REGION_SEQUENCE.length
assert MAX_AVAILABLE_REGION_SEQUENCES > 0

NULL_REGION_ID = 0


def msb_0_ordering(value: int, width: int) -> int:
    """
    MSB 0 Ordering refers to when the bit numbering starts at zero for the
    most significant bit (MSB) the numbering scheme is called MSB 0.
    """
    lsb_0_ordering = f"{value:0{width}b}"
    msb_0_ordering = lsb_0_ordering[::-1]
    return int(msb_0_ordering, 2)


def generate_snowflake_id(redis_key: str) -> int:
    segment_values = {}

    segment_values[VERSION_ID] = msb_0_ordering(settings.SNOWFLAKE_VERSION_ID, VERSION_ID.length)

    try:
        segment_values[REGION_ID] = get_local_region().snowflake_id
    except RegionContextError:  # expected if running in monolith mode
        segment_values[REGION_ID] = NULL_REGION_ID

    current_time = datetime.now().timestamp()
    # supports up to 130 years
    segment_values[TIME_DIFFERENCE] = int(current_time - settings.SENTRY_SNOWFLAKE_EPOCH_START)

    snowflake_id = 0
    (
        segment_values[TIME_DIFFERENCE],
        segment_values[REGION_SEQUENCE],
    ) = get_sequence_value_from_redis(redis_key, segment_values[TIME_DIFFERENCE])

    for segment in BIT_SEGMENT_SCHEMA:
        segment.validate(segment_values[segment])
        snowflake_id = (snowflake_id << segment.length) | segment_values[segment]

    ID_VALIDATOR.validate(snowflake_id)

    return snowflake_id


def get_redis_cluster(redis_key: str) -> StrictRedis[str]:
    from sentry.utils import redis

    return redis.clusters.get("default").get_local_client_for_key(redis_key)


def get_sequence_value_from_redis(redis_key: str, starting_timestamp: int) -> tuple[int, int]:
    cluster = get_redis_cluster(redis_key)

    # this is the amount we want to lookback for previous timestamps
    # the below is more of a safety net if starting_timestamp is ever
    # below 5 minutes, then we will change the lookback window accordingly
    time_range = min(starting_timestamp, int(_TTL.total_seconds()))

    for i in range(time_range):
        timestamp = starting_timestamp - i

        # We are decreasing the value by 1 each time since the incr operation in redis
        # initializes the counter at 1. For our region sequences, we want the value to
        # be from 0-15 and not 1-16
        sequence_value = cluster.incr(str(timestamp))
        sequence_value -= 1

        if sequence_value == 0:
            cluster.expire(str(timestamp), int(_TTL.total_seconds()))

        if sequence_value < MAX_AVAILABLE_REGION_SEQUENCES:
            return timestamp, sequence_value

    raise Exception("No available ID")
