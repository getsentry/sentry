"""Applying declared omission paths to the generated schema.

One segment is native to drf-spectacular; this covers the deeper paths.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sentry.apidocs.omission_paths import VALUE, PathError, resolve

# A deprecation marks the property rather than removing it.
DEPRECATE = "deprecate"

REF = "$ref"
_COMPONENT_PREFIX = "#/components/schemas/"


class OmissionError(Exception):
    """A declared path that cannot be applied to the generated schema."""


def _component_name(node: Any) -> str | None:
    """The component a property points at, through an allOf wrapper if present."""
    if not isinstance(node, dict):
        return None
    ref = node.get(REF)
    if ref is None:
        for arm in node.get("allOf") or []:
            if isinstance(arm, dict) and REF in arm:
                ref = arm[REF]
                break
    if not isinstance(ref, str) or not ref.startswith(_COMPONENT_PREFIX):
        return None
    return ref[len(_COMPONENT_PREFIX) :]


def _referenced_component(node: Any) -> str | None:
    """The component a property points at, directly or through a list's items."""
    if not isinstance(node, dict):
        return None
    return _component_name(node) or _component_name(node.get("items"))


def _properties(node: Any) -> dict[str, Any] | None:
    if not isinstance(node, dict):
        return None
    properties = node.get("properties")
    if isinstance(properties, dict):
        return properties
    items = node.get("items")
    if isinstance(items, dict):
        return _properties(items)
    return None


def parents_by_component(schemas: dict[str, Any]) -> dict[str, set[str]]:
    """Component name to the components holding a property that points at it."""
    parents: dict[str, set[str]] = {}
    for owner, body in schemas.items():
        for node in (_properties(body) or {}).values():
            target = _referenced_component(node)
            if target is not None:
                parents.setdefault(target, set()).add(owner)
    return parents


def _step(schemas: dict[str, Any], node: Any, segment: str, path: str) -> tuple[Any, str | None]:
    """Follow one segment, returning the next node and the component entered."""
    properties = _properties(node)
    if properties is None or segment not in properties:
        raise OmissionError(f"{path!r}: {segment!r} is not in the generated schema")
    child = properties[segment]
    entered = _referenced_component(child)
    if entered is not None:
        if entered not in schemas:
            raise OmissionError(f"{path!r}: {entered} is not a known component")
        return schemas[entered], entered
    return child, None


def apply_path(
    schemas: dict[str, Any],
    owner: str,
    path: str,
    kind: str,
    declarations: dict[str, set[str]],
    parents: dict[str, set[str]],
    withholds_default: bool = False,
    seen: set[tuple[int, str]] | None = None,
) -> None:
    """Withhold or mark one resolved path, starting from `owner`'s component.

    `declarations` maps a path to the components that declared it."""
    segments = path.split(".")
    node: Any = schemas[owner]
    holding: Any = node  # the object owning `node`, for a value's `required` list
    # The components this path passes through. They are its route rather than
    # competing users of what it reaches, so they do not dissent.
    route = {owner}
    for index, segment in enumerate(segments[:-1]):
        holding = node
        node, entered = _step(schemas, node, segment, path)
        if entered is None:
            continue
        agreed = declarations.get(path, set()) | route
        dissenting = sorted(parents.get(entered, set()) - agreed)
        if dissenting:
            raise OmissionError(
                f"{path!r} on {owner} descends into {entered}, which {', '.join(dissenting)} "
                f"also uses without declaring it. Withholding it there would hide the field "
                f"from a shape that did not ask; declare the same path on each parent, or "
                f"declare it on {entered} itself if it should be withheld everywhere."
            )
        route.add(entered)
    # A class and its subclass carry the same inherited path; apply it once
    # per target, or the second lookup finds a value already removed.
    if seen is not None:
        key = (id(node), path)
        if key in seen:
            return
        seen.add(key)
    _apply_leaf(node, segments[-1], kind, path, withholds_default, holding, segments[-2:-1])


def _apply_leaf(
    node: Any,
    segment: str,
    kind: str,
    path: str,
    withholds_default: bool = False,
    holding: Any = None,
    field: Sequence[str] = (),
) -> None:
    if kind == VALUE:
        holder = _enum_holder(node, segment, path)
        holder["enum"] = [value for value in holder["enum"] if str(value) != segment]
        strip_choice_description(holder, segment)
        if withholds_default:
            _require_without_default(holder, holding, field)
        return
    holder = _holder_of(node, segment, path)
    if kind == DEPRECATE:
        holder[segment] = _marked_deprecated(holder[segment])
        return
    del holder[segment]
    # A withheld property cannot stay in `required`: the schema would demand a
    # property it no longer declares.
    owner = _object_of(node)
    required = owner.get("required") if isinstance(owner, dict) else None
    if isinstance(required, list) and segment in required:
        owner["required"] = [name for name in required if name != segment]
        if not owner["required"]:
            del owner["required"]


def _require_without_default(holder: Any, holding: Any, field: Sequence[str]) -> None:
    """Withholding the fallback means the caller must send the value."""
    holder.pop("default", None)
    owner = _object_of(holding)
    if not field or not isinstance(owner, dict):
        return
    required = owner.setdefault("required", [])
    if field[0] not in required:
        required.append(field[0])
        required.sort()


def _marked_deprecated(schema: Any) -> Any:
    """Mark a property, wrapping a bare $ref so the sibling is not discarded."""
    if not isinstance(schema, dict):
        return schema
    if REF in schema:
        return {"allOf": [{REF: schema[REF]}], "deprecated": True}
    return {**schema, "deprecated": True}


def _object_of(node: Any) -> Any:
    """The object carrying `properties`, which for a list sits on its items."""
    if isinstance(node, dict) and isinstance(node.get("properties"), dict):
        return node
    if isinstance(node, dict) and isinstance(node.get("items"), dict):
        return _object_of(node["items"])
    return node


def _holder_of(node: Any, segment: str, path: str) -> dict[str, Any]:
    properties = _properties(node)
    if properties is None or segment not in properties:
        raise OmissionError(f"{path!r}: {segment!r} is not in the generated schema")
    return properties


def strip_choice_description(holder: Any, value: str) -> None:
    """Drop a withheld value from the generated choice listing.

    Every choice is named in the description, so the enum alone is not enough."""
    if not isinstance(holder, dict):
        return
    description = holder.get("description")
    if not isinstance(description, str):
        return
    kept = [line for line in description.splitlines() if not line.startswith(f"* `{value}`")]
    while kept and not kept[-1].strip():
        kept.pop()
    holder["description"] = "\n".join(kept)
    if not holder["description"]:
        del holder["description"]


def _enum_holder(node: Any, value: str, path: str) -> dict[str, Any]:
    """The node carrying the enum, which for a list sits on its items."""
    for candidate in (node, node.get("items") if isinstance(node, dict) else None):
        if isinstance(candidate, dict) and isinstance(candidate.get("enum"), list):
            if any(str(entry) == value for entry in candidate["enum"]):
                return candidate
            raise OmissionError(f"{path!r}: {value!r} is not in the generated enum")
    raise OmissionError(f"{path!r}: no enum to withhold {value!r} from")


def resolved_declarations(serializer: Any, paths: dict[str, str]) -> dict[str, Any]:
    """Path to resolution for the paths needing postprocessing, depth two or more."""
    deep = {path for path in paths if "." in path}
    resolved: dict[str, Any] = {}
    errors: list[str] = []
    for path in sorted(deep):
        try:
            resolved[path] = resolve(serializer, path)
        except PathError as exc:
            errors.append(str(exc))
    if errors:
        raise OmissionError("; ".join(errors))
    return resolved


def apply_to_operations(
    paths: dict[str, Any],
    field_names: set[str],
    path: str,
    kind: str,
    withholds_default: bool = False,
    seen: set[tuple[int, str]] | None = None,
) -> int:
    """Apply a path to query parameters a serializer was exploded into.

    Withholding the default drops it and requires the parameter."""
    segments = path.split(".")
    applied = 0
    resorted: list[dict[str, Any]] = []
    for operations in paths.values():
        for operation in operations.values():
            if not isinstance(operation, dict):
                continue
            parameters = {
                parameter["name"]: parameter
                for parameter in operation.get("parameters", [])
                if parameter.get("in") == "query"
            }
            if not field_names <= set(parameters):
                continue
            target = parameters[segments[0]]
            # A class and its subclass both carry an inherited path, and both
            # fingerprint the same operation. Apply it once.
            if seen is not None:
                key = (id(target), path)
                if key in seen:
                    continue
                seen.add(key)
            if kind == VALUE:
                holder = _enum_holder(target.get("schema", {}), segments[-1], path)
                holder["enum"] = [v for v in holder["enum"] if str(v) != segments[-1]]
                # build_parameter_type moves the description onto the parameter.
                strip_choice_description(target, segments[-1])
                strip_choice_description(holder, segments[-1])
                if withholds_default:
                    holder.pop("default", None)
                    target["required"] = True
                    resorted.append(operation)
            elif kind == DEPRECATE:
                target["deprecated"] = True
            else:
                _apply_leaf(target.get("schema", {}), segments[-1], kind, path)
            applied += 1
    for operation in resorted:
        _resort_parameters(operation)
    return applied


def _resort_parameters(operation: dict[str, Any]) -> None:
    """Re-apply the project's ordering after marking a parameter required.

    The sort runs during generation, before this hook makes the change it keys
    on, so an operation would otherwise list a required parameter among the
    optional ones."""
    from sentry.conf.server import custom_parameter_sort

    parameters = operation.get("parameters")
    if isinstance(parameters, list):
        operation["parameters"] = sorted(parameters, key=custom_parameter_sort)
