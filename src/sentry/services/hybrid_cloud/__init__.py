from __future__ import annotations

import contextlib
import datetime
import logging
import threading
from enum import Enum
from typing import (
    Any,
    Callable,
    Dict,
    Generator,
    Generic,
    Iterable,
    Mapping,
    Protocol,
    Type,
    TypeVar,
    cast,
)

import pydantic
from django.db import router, transaction
from django.db.models import Model
from typing_extensions import Self

from sentry.silo import SiloMode
from sentry.utils.env import in_test_environment

logger = logging.getLogger(__name__)

T = TypeVar("T")

ArgumentDict = Mapping[str, Any]

OptionValue = Any

IDEMPOTENCY_KEY_LENGTH = 48
REGION_NAME_LENGTH = 48

DEFAULT_DATE = datetime.datetime(2000, 1, 1)


class ValueEqualityEnum(Enum):
    def __eq__(self, other):
        value = other
        if isinstance(other, Enum):
            value = other.value
        return self.value == value

    def __hash__(self):
        return hash(self.value)


class RpcModel(pydantic.BaseModel):
    """A serializable object that may be part of an RPC schema."""

    class Config:
        orm_mode = True
        use_enum_values = True

    @classmethod
    def get_field_names(cls) -> Iterable[str]:
        return iter(cls.__fields__.keys())

    @classmethod
    def serialize_by_field_name(
        cls,
        obj: Any,
        name_transform: Callable[[str], str] | None = None,
        value_transform: Callable[[Any], Any] | None = None,
    ) -> Self:
        """Serialize an object with field names matching this model class.

        This class method may be called only on an instantiable subclass. The
        returned value is an instance of that subclass. The optional "transform"
        arguments, if present, modify each field name or attribute value before it is
        passed through to the serialized object. Raises AttributeError if the
        argument does not have an attribute matching each field name (after
        transformation, if any) of this RpcModel class.

        This method should not necessarily be used for every serialization operation.
        It is useful for model types, such as "flags" objects, where new fields may
        be added in the future and we'd like them to be serialized automatically. For
        more stable or more complex models, it is more suitable to list the fields
        out explicitly in a constructor call.
        """

        fields = {}

        for rpc_field_name in cls.get_field_names():
            if name_transform is not None:
                obj_field_name = name_transform(rpc_field_name)
            else:
                obj_field_name = rpc_field_name

            try:
                value = getattr(obj, obj_field_name)
            except AttributeError as e:
                msg = (
                    f"While serializing to {cls.__name__}, could not extract "
                    f"{obj_field_name!r} from {type(obj).__name__}"
                )
                if name_transform is not None:
                    msg += f" (transformed from {rpc_field_name!r})"
                raise AttributeError(msg) from e

            if value_transform is not None:
                value = value_transform(value)
            fields[rpc_field_name] = value

        return cls(**fields)


class RpcModelProtocolMeta(type(RpcModel), type(Protocol)):  # type: ignore
    """A unifying metaclass for RpcModel classes that also implement a Protocol."""


ServiceInterface = TypeVar("ServiceInterface")


class DelegatedBySiloMode(Generic[ServiceInterface]):
    """
    Using a mapping of silo modes to backing type classes that match the same ServiceInterface,
    delegate method calls to a singleton that is managed based on the current SiloMode.get_current_mode().
    This delegator is dynamic -- it knows to swap the backing implementation even when silo mode is overwritten
    during run time, or even via the stubbing methods in this module.

    It also supports lifecycle management by invoking close() on the backing implementation anytime either this
    service is closed, or when the backing service implementation changes.
    """

    _constructors: Mapping[SiloMode, Callable[[], ServiceInterface]]
    _singleton: Dict[SiloMode, ServiceInterface | None]
    _lock: threading.RLock

    def __init__(self, mapping: Mapping[SiloMode, Callable[[], ServiceInterface]]):
        self._constructors = mapping
        self._singleton = {}
        self._lock = threading.RLock()

    @contextlib.contextmanager
    def with_replacement(
        self, service: ServiceInterface | None, silo_mode: SiloMode
    ) -> Generator[None, None, None]:
        with self._lock:
            prev = self._singleton.get(silo_mode, None)
            self._singleton[silo_mode] = service
        try:
            yield
        finally:
            with self._lock:
                self._singleton[silo_mode] = prev

    def __getattr__(self, item: str) -> Any:
        cur_mode = SiloMode.get_current_mode()

        with self._lock:
            if impl := self._singleton.get(cur_mode, None):
                return getattr(impl, item)
            if con := self._constructors.get(cur_mode, None):
                self._singleton[cur_mode] = inst = con()
                return getattr(inst, item)

        raise KeyError(f"No implementation found for {cur_mode}.")


class DelegatedByOpenTransaction(Generic[ServiceInterface]):
    """
    It is possible to run monolith mode in a split database scenario -- in this case, the silo mode does not help
    select the correct implementation to ensure non mingled transactions.  This helper picks a backing implementation
    by checking if an open transaction exists for the routing of the given model for a backend implementation.

    If no transactions are open, it uses a given default implementation instead.
    """

    _constructors: Mapping[Type[Model], Callable[[], ServiceInterface]]
    _default: Callable[[], ServiceInterface]

    def __init__(
        self,
        mapping: Mapping[Type[Model], Callable[[], ServiceInterface]],
        default: Callable[[], ServiceInterface],
    ):
        self._constructors = mapping
        self._default = default

    def __getattr__(self, item: str) -> Any:
        for model, constructor in self._constructors.items():
            if in_test_environment():
                from sentry.testutils.hybrid_cloud import (  # NOQA:S007
                    simulated_transaction_watermarks,
                )

                open_transaction = (
                    simulated_transaction_watermarks.connection_transaction_depth_above_watermark(
                        using=router.db_for_write(model)
                    )
                    > 0
                )
            else:
                open_transaction = transaction.get_connection(
                    router.db_for_write(model)
                ).in_atomic_block

            if open_transaction:
                return getattr(constructor(), item)
        return getattr(self._default(), item)


def silo_mode_delegation(
    mapping: Mapping[SiloMode, Callable[[], ServiceInterface]]
) -> ServiceInterface:
    """
    Simply creates a DelegatedBySiloMode from a mapping object, but casts it as a ServiceInterface matching
    the mapping values.

    In split database mode, it will also inject DelegatedByOpenTransaction in for the monolith mode implementation.
    """

    return cast(ServiceInterface, DelegatedBySiloMode(get_delegated_constructors(mapping)))


def get_delegated_constructors(
    mapping: Mapping[SiloMode, Callable[[], ServiceInterface]]
) -> Mapping[SiloMode, Callable[[], ServiceInterface]]:
    """
    Creates a new constructor mapping by replacing the monolith constructor with a DelegatedByOpenTransaction
    that intelligently selects the correct service implementation based on the call site.
    """

    def delegator() -> ServiceInterface:
        from sentry.models.organization import Organization
        from sentry.models.user import User

        return cast(
            ServiceInterface,
            DelegatedByOpenTransaction(
                {
                    User: mapping[SiloMode.CONTROL],
                    Organization: mapping[SiloMode.REGION],
                },
                mapping[SiloMode.MONOLITH],
            ),
        )

    # We need to retain a closure around the original mapping passed in, so we'll use a new variable here
    final_mapping: Mapping[SiloMode, Callable[[], ServiceInterface]] = {
        SiloMode.MONOLITH: delegator,
        **({k: v for k, v in mapping.items() if k != SiloMode.MONOLITH}),
    }
    return final_mapping


def coerce_id_from(m: object | int | None) -> int | None:
    if m is None:
        return None
    if isinstance(m, int):
        return m
    if hasattr(m, "id"):
        return m.id
    raise ValueError(f"Cannot coerce {m!r} into id!")


def extract_id_from(m: object | int) -> int:
    if isinstance(m, int):
        return m
    if hasattr(m, "id"):
        return m.id
    raise ValueError(f"Cannot extract {m!r} from id!")
