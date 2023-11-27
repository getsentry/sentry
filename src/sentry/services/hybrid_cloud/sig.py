from __future__ import annotations

import inspect
import itertools
from typing import Any, Callable, Iterable, Sequence, Tuple, Type

import pydantic
from django.utils.functional import LazyObject

from sentry.services.hybrid_cloud import ArgumentDict


class _SerializableFunctionSignatureException(Exception):
    def __init__(self, signature: SerializableFunctionSignature, message: str) -> None:
        super().__init__(f"{signature.generate_name('.')}: {message}")


class SerializableFunctionSignatureSetupException(_SerializableFunctionSignatureException):
    """Indicate that a function signature can't be set up for serialization."""


class SerializableFunctionValueException(_SerializableFunctionSignatureException):
    """Indicate that a serialized function call received an invalid value."""


class SerializableFunctionSignature:
    """Represent a function's parameters and return type for serialization."""

    def __init__(self, base_function: Callable[..., Any], is_instance_method: bool = False) -> None:
        super().__init__()
        self.base_function = base_function
        self.is_instance_method = is_instance_method

        self._parameter_model = self._create_parameter_model()
        self._return_model = self._create_return_model()

    def get_name_segments(self) -> Sequence[str]:
        return (self.base_function.__name__,)

    def generate_name(self, joiner: str, suffix: str | None = None) -> str:
        segments: Iterable[str] = self.get_name_segments()
        if suffix is not None:
            segments = itertools.chain(segments, (suffix,))
        return joiner.join(segments)

    def _validate_type_token(self, value_label: str, token: Any) -> None:
        """Check whether a type token is usable.

        Strings as type annotations, which Mypy can use if their types are imported
        in an `if TYPE_CHECKING` block, can't be used for (de)serialization. Raise an
        exception if the given token is one of these.

        We can check only on a best-effort basis. String tokens may still be nested
        in type parameters (e.g., `Optional["RpcThing"]`), which this won't catch.
        Such a state would cause an exception when we attempt to use the signature
        object to (de)serialize something.
        """
        if isinstance(token, str):
            raise SerializableFunctionSignatureSetupException(
                self,
                f"Invalid type token on {value_label} "
                "(serializable functions must use concrete type tokens, not strings)",
            )

    def _create_parameter_model(self) -> Type[pydantic.BaseModel]:
        """Dynamically create a Pydantic model class representing the parameters."""

        def create_field(param: inspect.Parameter) -> Tuple[Any, Any]:
            if param.annotation is param.empty:
                raise SerializableFunctionSignatureSetupException(
                    self, "Type annotations are required to serialize"
                )
            self._validate_type_token(f"parameter `{param.name}`", param.annotation)

            default_value = ... if param.default is param.empty else param.default
            return param.annotation, default_value

        model_name = self.generate_name("__", "ParameterModel")
        parameters = list(inspect.signature(self.base_function).parameters.values())
        if self.is_instance_method:
            parameters = parameters[1:]  # exclude `self` argument
        field_definitions = {p.name: create_field(p) for p in parameters}
        return pydantic.create_model(model_name, **field_definitions)  # type: ignore[call-overload]

    _RETURN_MODEL_ATTR = "value"

    def _create_return_model(self) -> Type[pydantic.BaseModel] | None:
        """Dynamically create a Pydantic model class representing the return value.

        The created model has a single attribute containing the return value. This
        extra abstraction is necessary in order to have Pydantic handle generic
        return annotations such as `Optional[RpcOrganization]` or `List[RpcUser]`,
        where we can't directly access an RpcModel class on which to call `parse_obj`.
        """
        model_name = self.generate_name("__", "ReturnModel")
        return_type = inspect.signature(self.base_function).return_annotation
        if return_type is None:
            return None
        self._validate_type_token("return type", return_type)

        field_definitions = {self._RETURN_MODEL_ATTR: (return_type, ...)}
        return pydantic.create_model(model_name, **field_definitions)  # type: ignore[call-overload]

    @staticmethod
    def _unwrap_lazy_django_object(arg: Any) -> Any:
        """Unwrap any lazy objects before attempting to serialize.

        It's possible to receive a SimpleLazyObject initialized by the Django
        framework and pass it to an RPC (typically `request.user` as an RpcUser
        argument). These objects are supposed to behave seamlessly like the
        underlying type, but don't play nice with the reflection that Pydantic uses
        to serialize. So, we manually check and force them to unwrap.
        """

        if isinstance(arg, LazyObject):
            return getattr(arg, "_wrapped")
        else:
            return arg

    def serialize_arguments(self, raw_arguments: ArgumentDict) -> ArgumentDict:
        raw_arguments = {
            key: self._unwrap_lazy_django_object(arg) for (key, arg) in raw_arguments.items()
        }

        try:
            model_instance = self._parameter_model(**raw_arguments)
        except Exception as e:
            raise SerializableFunctionValueException(self, "Could not serialize arguments") from e
        return model_instance.dict()

    def deserialize_arguments(self, serial_arguments: ArgumentDict) -> pydantic.BaseModel:
        try:
            return self._parameter_model.parse_obj(serial_arguments)
        except Exception as e:
            raise SerializableFunctionValueException(self, "Could not deserialize arguments") from e

    def deserialize_return_value(self, value: Any) -> Any:
        if self._return_model is None:
            if value is not None:
                raise SerializableFunctionValueException(
                    self, f"Expected None but got {type(value)}"
                )
            return None

        parsed = self._return_model.parse_obj({self._RETURN_MODEL_ATTR: value})
        return getattr(parsed, self._RETURN_MODEL_ATTR)
