# mypy: disable-error-code=type-arg
# Vendored from rest_framework-stubs. One change: BaseSerializer takes a second
# parameter for the shape of validated_data. Both default to Any, so opting in
# is per-serializer. Declare keys NotRequired -- partial=True omits absent ones.
from _typeshed import Incomplete
from collections.abc import Iterable, Iterator, Mapping, MutableMapping, Sequence
from typing import Any, ClassVar, Generic, Literal, NoReturn, TypeVar

from django.db import models
from django.db.models import Manager, Model, QuerySet
from django.utils.functional import cached_property
from django_stubs_ext import StrOrPromise
from rest_framework.exceptions import APIException as APIException
from rest_framework.exceptions import AuthenticationFailed as AuthenticationFailed
from rest_framework.exceptions import ErrorDetail as ErrorDetail
from rest_framework.exceptions import MethodNotAllowed as MethodNotAllowed
from rest_framework.exceptions import NotAcceptable as NotAcceptable
from rest_framework.exceptions import NotAuthenticated as NotAuthenticated
from rest_framework.exceptions import NotFound as NotFound
from rest_framework.exceptions import ParseError as ParseError
from rest_framework.exceptions import PermissionDenied as PermissionDenied
from rest_framework.exceptions import Throttled as Throttled
from rest_framework.exceptions import UnsupportedMediaType as UnsupportedMediaType
from rest_framework.exceptions import ValidationError as ValidationError
from rest_framework.fields import BooleanField as BooleanField
from rest_framework.fields import CharField as CharField
from rest_framework.fields import ChoiceField as ChoiceField
from rest_framework.fields import CreateOnlyDefault as CreateOnlyDefault
from rest_framework.fields import CurrentUserDefault as CurrentUserDefault
from rest_framework.fields import DateField as DateField
from rest_framework.fields import DateTimeField as DateTimeField
from rest_framework.fields import DecimalField as DecimalField
from rest_framework.fields import DictField as DictField
from rest_framework.fields import DurationField as DurationField
from rest_framework.fields import EmailField as EmailField
from rest_framework.fields import Field as Field
from rest_framework.fields import FileField as FileField
from rest_framework.fields import FilePathField as FilePathField
from rest_framework.fields import FloatField as FloatField
from rest_framework.fields import HiddenField as HiddenField
from rest_framework.fields import HStoreField as HStoreField
from rest_framework.fields import ImageField as ImageField
from rest_framework.fields import IntegerField as IntegerField
from rest_framework.fields import IPAddressField as IPAddressField
from rest_framework.fields import JSONField as JSONField
from rest_framework.fields import ListField as ListField
from rest_framework.fields import ModelField as ModelField
from rest_framework.fields import MultipleChoiceField as MultipleChoiceField
from rest_framework.fields import NullBooleanField as NullBooleanField
from rest_framework.fields import ReadOnlyField as ReadOnlyField
from rest_framework.fields import RegexField as RegexField
from rest_framework.fields import SerializerMethodField as SerializerMethodField
from rest_framework.fields import SkipField as SkipField
from rest_framework.fields import SlugField as SlugField
from rest_framework.fields import TimeField as TimeField
from rest_framework.fields import URLField as URLField
from rest_framework.fields import UUIDField as UUIDField
from rest_framework.fields import _DefaultInitial
from rest_framework.fields import empty as empty
from rest_framework.relations import Hyperlink as Hyperlink
from rest_framework.relations import HyperlinkedIdentityField as HyperlinkedIdentityField
from rest_framework.relations import HyperlinkedRelatedField as HyperlinkedRelatedField
from rest_framework.relations import ManyRelatedField as ManyRelatedField
from rest_framework.relations import PrimaryKeyRelatedField as PrimaryKeyRelatedField
from rest_framework.relations import RelatedField as RelatedField
from rest_framework.relations import SlugRelatedField as SlugRelatedField
from rest_framework.relations import StringRelatedField as StringRelatedField
from rest_framework.utils.model_meta import FieldInfo, RelationInfo
from rest_framework.utils.serializer_helpers import BindingDict, BoundField, ReturnDict, ReturnList
from rest_framework.validators import BaseUniqueForValidator, UniqueTogetherValidator, Validator
from typing_extensions import Self

LIST_SERIALIZER_KWARGS: Sequence[str]
LIST_SERIALIZER_KWARGS_REMOVE: Sequence[str]
ALL_FIELDS: str

_MT = TypeVar("_MT", bound=Model)  # Model Type
_IN = TypeVar("_IN", default=Any)  # Instance Type
_TVal = TypeVar("_TVal", default=Any)  # shape of validated_data

class BaseSerializer(Field[Any, Any, Any, _IN], Generic[_IN, _TVal]):
    partial: bool
    many: bool
    instance: _IN | None
    initial_data: Any
    _context: dict[str, Any]
    def __new__(cls, *args: Any, **kwargs: Any) -> Self: ...
    def __class_getitem__(cls, *args: Incomplete, **kwargs: Incomplete) -> Incomplete: ...
    def __init__(
        self,
        instance: _IN | None = ...,
        data: Any = ...,
        *,
        partial: bool = ...,
        many: bool = ...,
        allow_empty: bool = ...,
        context: dict[str, Any] = ...,
        read_only: bool = ...,
        write_only: bool = ...,
        required: bool | None = None,
        default: Any = ...,
        initial: Any = ...,
        source: str | None = None,
        label: StrOrPromise | None = None,
        help_text: StrOrPromise | None = None,
        style: dict[str, Any] | None = None,
        error_messages: dict[str, StrOrPromise] | None = None,
        validators: Sequence[Validator[Any]] | None = ...,
        allow_null: bool = ...,
    ) -> None: ...
    @classmethod
    def many_init(cls, *args: Any, **kwargs: Any) -> BaseSerializer: ...
    def is_valid(self, *, raise_exception: bool = ...) -> bool: ...
    @property
    def data(self) -> Any: ...
    @property
    def errors(self) -> Iterable[Any]: ...
    @property
    def validated_data(self) -> _TVal: ...
    def update(self, instance: _IN, validated_data: Any) -> _IN: ...
    def create(self, validated_data: Any) -> _IN: ...
    def save(self, **kwargs: Any) -> _IN: ...
    def to_representation(self, instance: _IN) -> Any: ...

class SerializerMetaclass(type):
    def __new__(cls, name: Any, bases: Any, attrs: Any) -> Incomplete: ...
    @classmethod
    def _get_declared_fields(
        cls, bases: Sequence[type], attrs: dict[str, Any]
    ) -> dict[str, Field]: ...

def as_serializer_error(exc: Exception) -> dict[str, list[ErrorDetail]]: ...

class Serializer(BaseSerializer[_IN, _TVal], metaclass=SerializerMetaclass):
    _declared_fields: dict[str, Field]
    default_error_messages: ClassVar[dict[str, StrOrPromise]]
    def get_initial(self) -> Any: ...
    def set_value(
        self, dictionary: MutableMapping[str, Any], keys: Sequence[str], value: Any
    ) -> None: ...
    @cached_property
    def fields(self) -> BindingDict: ...
    def get_fields(self) -> dict[str, Field]: ...
    def to_representation(self, instance: _IN) -> dict[str, Any]: ...
    def validate(self, attrs: Any) -> Any: ...
    def __iter__(self) -> Iterator[BoundField]: ...
    def __getitem__(self, key: str) -> BoundField: ...
    def _read_only_defaults(self) -> dict[str, Any]: ...
    @property
    def _writable_fields(self) -> list[Field]: ...
    @property
    def _readable_fields(self) -> list[Field]: ...
    @property
    def data(self) -> ReturnDict: ...
    @property
    def errors(self) -> ReturnDict: ...

class ListSerializer(BaseSerializer[_IN, _TVal]):
    child: Field | BaseSerializer | None
    many: bool
    default_error_messages: ClassVar[dict[str, StrOrPromise]]
    allow_empty: bool | None
    def __init__(
        self,
        instance: _IN | None = ...,
        data: Any = ...,
        partial: bool = ...,
        context: dict[str, Any] = ...,
        allow_empty: bool = ...,
        child: Field | BaseSerializer | None = ...,
        read_only: bool = ...,
        write_only: bool = ...,
        required: bool | None = None,
        default: Any = ...,
        initial: Any = ...,
        source: str | None = None,
        label: StrOrPromise | None = None,
        help_text: StrOrPromise | None = None,
        style: dict[str, Any] | None = None,
        error_messages: dict[str, StrOrPromise] | None = None,
        validators: Sequence[Validator[list[Any]]] | None = ...,
        allow_null: bool = ...,
        min_length: int | None = ...,
        max_length: int | None = ...,
    ) -> None: ...
    def run_child_validation(self, data: Any) -> Any: ...
    def to_representation(self, data: Manager[Any] | Iterable[Any]) -> list[Any]: ...  # type: ignore[override]
    def get_initial(self) -> list[Mapping[Any, Any]]: ...
    def validate(self, attrs: Any) -> Any: ...
    @property
    def data(self) -> ReturnList: ...
    @property
    def errors(self) -> ReturnList: ...

def raise_errors_on_nested_writes(
    method_name: str, serializer: BaseSerializer, validated_data: Any
) -> None: ...

class ModelSerializer(Serializer[_MT]):
    serializer_field_mapping: ClassVar[dict[type[models.Field], type[Field]]]
    serializer_related_field: ClassVar[type[RelatedField]]
    serializer_related_to_field: ClassVar[type[RelatedField]]
    serializer_url_field: ClassVar[type[RelatedField]]
    serializer_choice_field: ClassVar[type[Field]]
    url_field_name: ClassVar[str | None]

    class Meta:
        model: ClassVar[type[_MT]]  # type: ignore[valid-type]
        fields: ClassVar[Sequence[str] | Literal["__all__"]]
        read_only_fields: ClassVar[Sequence[str] | None]
        exclude: ClassVar[Sequence[str] | None]
        depth: ClassVar[int | None]
        extra_kwargs: ClassVar[dict[str, dict[str, Any]]]

    def __init__(
        self,
        instance: None | _MT | Sequence[_MT] | QuerySet[_MT] | Manager[_MT] = ...,
        data: Any = ...,
        *,
        partial: bool = ...,
        many: bool = ...,
        context: dict[str, Any] = ...,
        read_only: bool = ...,
        write_only: bool = ...,
        required: bool | None = None,
        default: _DefaultInitial[_MT | Sequence[_MT]] = ...,
        initial: _DefaultInitial[_MT | Sequence[_MT]] = ...,
        source: str | None = None,
        label: StrOrPromise | None = None,
        help_text: StrOrPromise | None = None,
        style: dict[str, Any] | None = None,
        error_messages: dict[str, StrOrPromise] | None = None,
        validators: Sequence[Validator[_MT]] | None = ...,
        allow_null: bool = ...,
        allow_empty: bool = ...,
    ) -> None: ...
    def update(self, instance: _MT, validated_data: Any) -> _MT: ...
    def create(self, validated_data: Any) -> _MT: ...
    def save(self, **kwargs: Any) -> _MT: ...
    def get_field_names(
        self, declared_fields: Mapping[str, Field], info: FieldInfo
    ) -> list[str]: ...
    def get_default_field_names(
        self, declared_fields: Mapping[str, Field], model_info: FieldInfo
    ) -> list[str]: ...
    def build_field(
        self, field_name: str, info: FieldInfo, model_class: type[_MT], nested_depth: int
    ) -> tuple[type[Field], dict[str, Any]]: ...
    def build_standard_field(
        self, field_name: str, model_field: models.Field
    ) -> tuple[type[Field], dict[str, Any]]: ...
    def build_relational_field(
        self, field_name: str, relation_info: RelationInfo
    ) -> tuple[type[Field], dict[str, Any]]: ...
    def build_nested_field(
        self, field_name: str, relation_info: RelationInfo, nested_depth: int
    ) -> tuple[type[Field], dict[str, Any]]: ...
    def build_property_field(
        self, field_name: str, model_class: type[_MT]
    ) -> tuple[type[Field], dict[str, Any]]: ...
    def build_url_field(
        self, field_name: str, model_class: type[_MT]
    ) -> tuple[type[Field], dict[str, Any]]: ...
    def build_unknown_field(self, field_name: str, model_class: type[_MT]) -> NoReturn: ...
    def include_extra_kwargs(
        self, kwargs: MutableMapping[str, Any], extra_kwargs: MutableMapping[str, Any]
    ) -> MutableMapping[str, Any]: ...
    def get_extra_kwargs(self) -> dict[str, Any]: ...
    def get_unique_together_constraints(
        self, model: _MT
    ) -> Iterator[tuple[set[tuple[str, ...]], Manager[_MT]]]: ...
    def get_uniqueness_extra_kwargs(
        self,
        field_names: Iterable[str],
        declared_fields: Mapping[str, Field],
        extra_kwargs: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, HiddenField]]: ...
    def _get_model_fields(
        self,
        field_names: Iterable[str],
        declared_fields: Mapping[str, Field],
        extra_kwargs: MutableMapping[str, Any],
    ) -> dict[str, models.Field]: ...
    def get_unique_together_validators(self) -> list[UniqueTogetherValidator]: ...
    def get_unique_for_date_validators(self) -> list[BaseUniqueForValidator]: ...

class HyperlinkedModelSerializer(ModelSerializer[_MT]): ...
