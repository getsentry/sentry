import contextlib
import copy
from collections.abc import Iterator
from typing import Any

from drf_spectacular.drainage import get_override
from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import force_instance, get_doc, is_basic_serializer
from drf_spectacular.utils import OpenApiParameter

from sentry.apidocs.omission_apply import (
    OmissionError,
    check_required_parameters,
    check_withheld_values,
    choice_rules,
    withhold_values,
)
from sentry.apidocs.omission_guard import in_operation, omissions_enabled, placed_at, record
from sentry.apidocs.omission_paths import Resolved
from sentry.apidocs.omissions import DEPRECATION_REASONS_OVERRIDE, OMISSION_REASONS_OVERRIDE
from sentry.apidocs.utils import SentryApiBuildError


class SentrySchema(AutoSchema):
    """DRF Documentation Schema for sentry endpoints"""

    @property
    def view_func(self):
        return getattr(self.view, self.method.lower())

    def get_operation_id(self) -> str:
        """
        First line of an endpoint's docstring is the operation IDZ
        """
        docstring = get_doc(self.view_func).splitlines()
        if len(docstring) > 1:
            return docstring[0]
        return super().get_operation_id()

    def get_description(self) -> str:  # type: ignore[override]
        """
        Docstring is used as a description for the endpoint. The operation ID is included in this.
        """
        docstring = get_doc(self.view_func)
        if len(docstring.splitlines()) > 1:
            return docstring
        return super().get_description()

    def resolve_serializer(
        self, serializer: Any, direction: Any, bypass_extensions: bool = False
    ) -> Any:
        """Note which component the serializer is mapped into, for the build's check."""
        name = self._get_serializer_name(force_instance(serializer), direction, bypass_extensions)
        with placed_at(("components", name)):
            return super().resolve_serializer(serializer, direction, bypass_extensions)

    def _map_serializer(
        self, serializer: Any, direction: Any, bypass_extensions: bool = False
    ) -> Any:
        """Withhold declared choices from the schema of the serializer declaring them.

        Components and exploded query parameters are both built here."""
        instance = force_instance(serializer)
        if not omissions_enabled():
            with _decorator_exclusions_suspended(instance):
                return super()._map_serializer(instance, direction, bypass_extensions)

        schema = super()._map_serializer(instance, direction, bypass_extensions)
        rules = _choice_rules(instance)
        try:
            if not in_operation():
                # Query parameters are recorded once explicit ones have replaced fields.
                _record(instance, rules)
            if not rules:
                return schema
            withheld = withhold_values(schema, rules)
            check_withheld_values(schema, withheld, rules)
        except OmissionError as exc:
            raise SentryApiBuildError(f"{type(instance).__name__}: {exc}") from exc
        return withheld

    def _process_override_parameters(self, direction: Any = "request") -> Any:
        """Mark a parameter required when its serializer withholds the default.

        drf-spectacular takes `required` from the field, which still has one."""
        with placed_at(("operations", self.get_operation_id())):
            result = super()._process_override_parameters(direction)
        _lift_deprecated(result)
        if not omissions_enabled():
            return result

        # Which declaration produced each parameter; a later one replaces an earlier one.
        source: dict[tuple[str, str], Any] = {}
        for parameter in self.get_override_parameters():
            if isinstance(parameter, OpenApiParameter):
                source[parameter.name, parameter.location] = parameter
            elif is_basic_serializer(parameter):
                for name in force_instance(parameter).fields:
                    source[name, OpenApiParameter.QUERY] = parameter
        serializers = {id(p): p for p in source.values() if not isinstance(p, OpenApiParameter)}
        try:
            with placed_at(("operations", self.get_operation_id())):
                for serializer in serializers.values():
                    owned = {name for (name, _), src in source.items() if src is serializer}
                    _record(force_instance(serializer), _choice_rules(serializer), owned)
        except OmissionError as exc:
            raise SentryApiBuildError(str(exc)) from exc
        required: set[tuple[str, str]] = set()
        for serializer in serializers.values():
            for rule in _choice_rules(serializer).values():
                key = (rule.segments[0], OpenApiParameter.QUERY)
                if rule.withholds_default and source.get(key) is serializer and result.get(key):
                    required.add(key)
        if not required:
            return result

        before = copy.deepcopy(result)
        for key in required:
            result[key]["required"] = True
        try:
            check_required_parameters(before, result, required)
        except OmissionError as exc:
            raise SentryApiBuildError(str(exc)) from exc
        return result


def _choice_rules(serializer: Any) -> dict[str, Resolved]:
    try:
        return choice_rules(force_instance(serializer))
    except OmissionError as exc:
        raise SentryApiBuildError(str(exc)) from exc


def _lift_deprecated(parameters: dict[tuple[str, str], Any]) -> None:
    """Mark a deprecated parameter on the parameter, where SDK generators read it.

    drf-spectacular leaves a deprecated serializer field's marker in its schema."""
    for parameter in parameters.values():
        schema = (parameter or {}).get("schema")
        if isinstance(schema, dict) and schema.pop("deprecated", False):
            parameter["deprecated"] = True


def _record(instance: Any, rules: dict[str, Resolved], owned: set[str] | None = None) -> None:
    """Note `instance`'s declarations for the build's check, limited to `owned` fields."""

    def kept(names: set[str]) -> set[str]:
        return names if owned is None else names & owned

    record(
        type(instance).__name__,
        kept(_declared_fields(instance, OMISSION_REASONS_OVERRIDE)),
        kept(_declared_fields(instance, DEPRECATION_REASONS_OVERRIDE)),
        {path: rule for path, rule in rules.items() if owned is None or rule.segments[0] in owned},
    )


def _declared_fields(serializer: Any, key: str) -> set[str]:
    """Whole fields the decorator declared under `key`, which drf-spectacular applies."""
    return {path for path in get_override(serializer, key, {}) or {} if "." not in path}


@contextlib.contextmanager
def _decorator_exclusions_suspended(instance: Any) -> Iterator[None]:
    """Map `instance` as if the decorator had not excluded or deprecated its fields.

    The override is shadowed on the instance alone, so the class is untouched."""
    omitted = _declared_fields(instance, OMISSION_REASONS_OVERRIDE)
    deprecated = _declared_fields(instance, DEPRECATION_REASONS_OVERRIDE)
    if not omitted and not deprecated:
        yield
        return
    own = vars(instance).get("_spectacular_annotation", _MISSING)
    annotation = dict(getattr(instance, "_spectacular_annotation", {}))
    annotation["exclude_fields"] = [
        f for f in annotation.get("exclude_fields", []) if f not in omitted
    ]
    annotation["deprecate_fields"] = [
        f for f in annotation.get("deprecate_fields", []) if f not in deprecated
    ]
    instance._spectacular_annotation = annotation
    try:
        yield
    finally:
        if own is _MISSING:
            del instance._spectacular_annotation
        else:
            instance._spectacular_annotation = own


_MISSING = object()
