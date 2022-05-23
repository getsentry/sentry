import random
import secrets
from collections import OrderedDict
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Callable, Mapping, Tuple, cast

from django.conf import settings
from django.db import models
from django.db.models import signals
from django.utils import timezone

from sentry.utils import json, redis

from .fields.bounded import BoundedBigAutoField
from .manager import BaseManager, M
from .query import update

__all__ = ("BaseModel", "Model", "DefaultFieldsModel", "sane_repr")


def sane_repr(*attrs: str) -> Callable[[models.Model], str]:
    if "id" not in attrs and "pk" not in attrs:
        attrs = ("id",) + attrs

    def _repr(self: models.Model) -> str:
        cls = type(self).__name__

        pairs = (f"{a}={getattr(self, a, None)!r}" for a in attrs)

        return "<{} at 0x{:x}: {}>".format(cls, id(self), ", ".join(pairs))

    return _repr


class BaseModel(models.Model):  # type: ignore
    class Meta:
        abstract = True

    objects = BaseManager[M]()

    update = update

    def __getstate__(self) -> Mapping[str, Any]:
        d = self.__dict__.copy()
        # we can't serialize weakrefs
        d.pop("_Model__data", None)
        return d

    def __hash__(self) -> int:
        # Django decided that it shouldn't let us hash objects even though they have
        # memory addresses. We need that behavior, so let's revert.
        if self.pk:
            return cast(int, models.Model.__hash__(self))
        return id(self)

    def __reduce__(
        self,
    ) -> Tuple[Callable[[int], models.Model], Tuple[Tuple[str, str]], Mapping[str, Any]]:
        (model_unpickle, stuff, _) = super().__reduce__()
        return (model_unpickle, stuff, self.__getstate__())

    def __setstate__(self, state: Mapping[str, Any]) -> None:
        self.__dict__.update(state)

    def set_cached_field_value(self, field_name: str, value: Any) -> None:
        # Explicitly set a field's cached value.
        # This only works for relational fields, and is useful when
        # you already have the value and can therefore use this
        # to populate Django's cache before accessing the attribute
        # and triggering a duplicate, unnecessary query.
        self._meta.get_field(field_name).set_cached_value(self, value)

    def get_cached_field_value(self, field_name: str) -> Any:
        # Get a relational field's cached value.
        # It's recommended to only use this in testing code,
        # for when you would like to inspect the cache.
        # In production, you should guard `model.field` with an
        # `if model.is_field_cached`.
        name = self._meta.get_field(field_name).get_cache_name()
        return self._state.fields_cache.get(name, None)

    def delete_cached_field_value(self, field_name: str) -> None:
        name = self._meta.get_field(field_name).get_cache_name()
        if name in self._state.fields_cache:
            del self._state.fields_cache[name]

    def is_field_cached(self, field_name: str) -> bool:
        # Ask if a relational field has a cached value.
        name = self._meta.get_field(field_name).get_cache_name()
        return name in self._state.fields_cache


class Model(BaseModel):
    id = BoundedBigAutoField(primary_key=True)

    class Meta:
        abstract = True

    __repr__ = sane_repr("id")


@dataclass
class SnowflakeBitSegment:
    length: int
    name: str

    def validate(self, value):
        if self.length <= 0:
            raise Exception("The length should be a positive number")
        if value >> self.length != 0:
            raise Exception(f"{self.name} exceed max bit value of {self.length}")
        return True


class Snowflake:
    _TTL = timedelta(minutes=500)

    SENTRY_EPOCH_START = datetime(2022, 4, 26, 0, 0).timestamp()
    SNOWFLAKE_ID_LENGTH = getattr(settings, "SNOWFLAKE_ID_LENGTH", 53)
    SNOWFLAKE_VERSION_ID_LENGTH = getattr(settings, "SNOWFLAKE_VERSION_ID_LENGTH", 5)
    SNOWFLAKE_TIME_DIFFERENCE_LENGTH = getattr(settings, "SNOWFLAKE_TIME_DIFFERENCE_LENGTH", 32)
    SNOWFLAKE_REGION_ID_LENGTH = getattr(settings, "SNOWFLAKE_REGION_ID_LENGTH", 12)
    SNOWFLAKE_REGION_SEQUENCE_LENGTH = getattr(settings, "SNOWFLAKE_REGION_SEQUENCE_LENGTH", 4)
    SNOWFLAKE_ID_VALIDATOR = SnowflakeBitSegment(SNOWFLAKE_ID_LENGTH, "Snowflake ID")

    SEGMENT_LENGTH = OrderedDict()
    SEGMENT_LENGTH["VERSION_ID"] = SnowflakeBitSegment(SNOWFLAKE_VERSION_ID_LENGTH, "Version ID")
    SEGMENT_LENGTH["TIME_DIFFERENCE"] = SnowflakeBitSegment(
        SNOWFLAKE_TIME_DIFFERENCE_LENGTH, "Time difference"
    )
    SEGMENT_LENGTH["REGION_ID"] = SnowflakeBitSegment(SNOWFLAKE_REGION_ID_LENGTH, "Region ID")
    SEGMENT_LENGTH["REGION_SEQUENCE"] = SnowflakeBitSegment(
        SNOWFLAKE_REGION_SEQUENCE_LENGTH, "Region sequence"
    )

    SEGMENT_VALUE = {
        "VERSION_ID": 0,
        "TIME_DIFFERENCE": 0,
        "REGION_ID": 0,
        "REGION_SEQUENCE": 0,
    }

    # Use the good RNG for this, not `random`. If multiple nodes are spinning up at
    # the same time, there's a chance that two of them will seed their default PRNG
    # with the same timestamp.
    BASE_SEED = secrets.randbits(64)

    id = BoundedBigAutoField(primary_key=True)

    def __init__(self):
        values = list(range(1 << self.SNOWFLAKE_REGION_SEQUENCE_LENGTH))
        r = random.Random(self.BASE_SEED ^ int(datetime.now().timestamp()))
        r.shuffle(values)
        self.region_sequence_order = values

    def snowflake_id_generation(self, redis_key: str) -> int:
        # current_time = datetime.now().timestamp()
        # supports up to 130 years
        # self.SEGMENT_VALUE["TIME_DIFFERENCE"] = int(current_time - self.SENTRY_EPOCH_START)

        # for testing purposes only
        self.SEGMENT_VALUE["TIME_DIFFERENCE"] = 18

        total_bits_to_allocate = self.SNOWFLAKE_ID_LENGTH
        snowflake_id = 0

        self.removed_used_region_sequence_from_list(
            self.SEGMENT_VALUE["TIME_DIFFERENCE"], redis_key
        )
        # do we need to check whats been used already before we assign?
        if self.region_sequence_order:
            self.SEGMENT_VALUE["REGION_SEQUENCE"] = self.region_sequence_order.pop()

            #  store used region_seq to redis here
            self.store_snowflake_to_redis(
                redis_key,
                self.SEGMENT_VALUE["TIME_DIFFERENCE"],
                self.SEGMENT_VALUE["REGION_SEQUENCE"],
            )

        else:
            (
                self.SEGMENT_VALUE["TIME_DIFFERENCE"],
                self.SEGMENT_VALUE["REGION_SEQUENCE"],
            ) = self.get_snowflake_from_redis(redis_key)

        for key, segment in self.SEGMENT_LENGTH.items():
            if segment.validate(self.SEGMENT_VALUE[key]):
                total_bits_to_allocate -= segment.length
                snowflake_id += self.SEGMENT_VALUE[key] << (total_bits_to_allocate)

        self.SNOWFLAKE_ID_VALIDATOR.validate(snowflake_id)

        return snowflake_id

    def get_redis_cluster(self, redis_key: str):
        return redis.clusters.get("default").get_local_client_for_key(redis_key)

    def store_snowflake_to_redis(
        self, redis_key: str, timestamp: int, used_region_sequence: int
    ) -> None:
        cluster = self.get_redis_cluster(redis_key)
        used_region_sequences = cluster.get(str(timestamp))
        if used_region_sequences:
            used_region_sequences = json.loads(used_region_sequences)
        else:
            used_region_sequences = []
        used_region_sequences.append(used_region_sequence)
        cluster.setex(
            str(timestamp), int(self._TTL.total_seconds()), json.dumps(used_region_sequences)
        )

    def get_snowflake_from_redis(self, redis_key: str) -> Tuple[int, int]:
        cluster = self.get_redis_cluster(redis_key)

        # temp code for now, want to iterate all keys in redis scan_iter() maybe?
        for i in range(300):
            timestamp = self.SEGMENT_VALUE["TIME_DIFFERENCE"] - i
            # do i need to reorder these to avoid collision?
            used_region_sequences = cluster.get(str(timestamp))
            if used_region_sequences:
                used_region_sequences = json.loads(used_region_sequences)

                if len(used_region_sequences) != (1 << self.SNOWFLAKE_REGION_SEQUENCE_LENGTH):
                    for region_sequence in range(1 << self.SNOWFLAKE_REGION_SEQUENCE_LENGTH):
                        if region_sequence not in used_region_sequences:
                            self.store_snowflake_to_redis(redis_key, timestamp, region_sequence)
                            return timestamp, region_sequence

        raise Exception("No available ID")

    def removed_used_region_sequence_from_list(self, timestamp: int, redis_key: str):
        cluster = self.get_redis_cluster(redis_key)
        used_region_sequences = cluster.get(str(timestamp))
        if used_region_sequences:
            used_region_sequences = json.loads(used_region_sequences)

            used_sequence_set = set(used_region_sequences)

            self.region_sequence_order = [
                sequence
                for sequence in self.region_sequence_order
                if sequence not in used_sequence_set
            ]


class DefaultFieldsModel(Model):
    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        abstract = True


def __model_pre_save(instance: models.Model, **kwargs: Any) -> None:
    if not isinstance(instance, DefaultFieldsModel):
        return
    instance.date_updated = timezone.now()


def __model_post_save(instance: models.Model, **kwargs: Any) -> None:
    if not isinstance(instance, BaseModel):
        return


def __model_class_prepared(sender: Any, **kwargs: Any) -> None:
    if not issubclass(sender, BaseModel):
        return

    if not hasattr(sender, "__include_in_export__"):
        raise ValueError(
            f"{sender!r} model has not defined __include_in_export__. This is used to determine "
            f"which models we export from sentry as part of our migration workflow: \n"
            f"https://docs.sentry.io/product/sentry-basics/migration/#3-export-your-data.\n"
            f"This should be True for core, low volume models used to configure Sentry. Things like "
            f"Organization, Project  and related settings. It should be False for high volume models "
            f"like Group."
        )


signals.pre_save.connect(__model_pre_save)
signals.post_save.connect(__model_post_save)
signals.class_prepared.connect(__model_class_prepared)
