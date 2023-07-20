from __future__ import annotations

import contextlib
import datetime
import functools
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
    Optional,
    Tuple,
    Type,
    TypeVar,
    Union,
    cast,
)

import pydantic
import sentry_sdk
from typing_extensions import Self

from sentry.silo import SiloMode

logger = logging.getLogger(__name__)

T = TypeVar("T")

ArgumentDict = Mapping[str, Any]

OptionValue = Union[str, int, bool, None]

IDEMPOTENCY_KEY_LENGTH = 48
REGION_NAME_LENGTH = 48

DEFAULT_DATE = datetime.datetime(2000, 1, 1)


def report_pydantic_type_validation_error(
    field: pydantic.fields.ModelField,
    value: Any,
    errors: pydantic.error_wrappers.ErrorList,
    model_class: Optional[Type[Any]],
) -> None:
    with sentry_sdk.push_scope() as scope:
        scope.set_context(
            "pydantic_validation",
            {
                "field": field.name,
                "value_type": str(type(value)),
                "errors": str(errors),
                "model_class": str(model_class),
            },
        )
        logger.warning("Pydantic type validation error", exc_info=True)


def _hack_pydantic_type_validation() -> None:
    """Disable strict type checking on Pydantic models.

    This is a temporary measure to ensure stability while we represent RpcModel
    objects as Pydantic models. Previously, those objects were dataclasses whose type
    annotations were checked statically but not at runtime. There may be bugs where
    those objects are constructed with the wrong type (typically None on a
    non-Optional field), but otherwise everything works.

    To prevent these from being hard errors, override Pydantic's validation behavior.
    Unfortunately, there is no way (that we know of) to do this only on RpcModel and
    its subclasses. We have to kludge it by tampering with Pydantic's global
    ModelField class, which would affect the behavior of all types extending
    pydantic.BaseModel in the code base. (As of this writing, there are no such
    classes other than RpcModel, but be warned.)

    See https://github.com/pydantic/pydantic/issues/897

    TODO: Remove this kludge when we are reasonably confident it is no longer
          producing any warnings
    """

    builtin_validate = pydantic.fields.ModelField.validate

    def validate(
        field: pydantic.fields.ModelField,
        value: Any,
        *args: Any,
        cls: Optional[Type[Union[pydantic.BaseModel, pydantic.dataclasses.Dataclass]]] = None,
        **kwargs: Any,
    ) -> Tuple[Optional[Any], Optional[pydantic.error_wrappers.ErrorList]]:
        result, errors = builtin_validate(field, value, *args, cls=cls, **kwargs)
        if errors:
            report_pydantic_type_validation_error(field, value, errors, cls)
        return result, None

    functools.update_wrapper(validate, builtin_validate)
    pydantic.fields.ModelField.validate = validate  # type: ignore


_hack_pydantic_type_validation()


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


def silo_mode_delegation(
    mapping: Mapping[SiloMode, Callable[[], ServiceInterface]]
) -> ServiceInterface:
    """
    Simply creates a DelegatedBySiloMode from a mapping object, but casts it as a ServiceInterface matching
    the mapping values.
    """
    return cast(ServiceInterface, DelegatedBySiloMode(mapping))


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
