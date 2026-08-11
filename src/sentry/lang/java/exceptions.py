import re
from collections.abc import Mapping
from typing import Any

from sentry.utils.safe import get_path

_JAVA_CLASS_IN_TEXT_RE = re.compile(
    r"""
    # Match likely Java class references inside free text. Examples:
    #  - com.example.app.MainActivity
    #  - a.b.c (obfuscated packages)
    #  - a.b$1 (anonymous/inner classes)
    #  - a.b$c (inner class)
    #  - a.b.c$D$1
    #  - kotlin.Unit or androidx.core.View
    #  - 'o' or "o" (quoted single-segment obfuscated class names)
    # Heuristics:
    #  - Either at least two identifiers separated by '.'
    #  - Or a single identifier wrapped in quotes (to avoid matching random words)
    #  - Identifiers may include letters, digits, '_' and '$'
    (
        (?:[A-Za-z_$][\w$]*\.){1,}[A-Za-z_$][\w$]*(?:\$[A-Za-z_$][\w$]*)*
        |
        ['"][A-Za-z_$][\w$]*['"]
    )
    """,
    re.X,
)

# R8 can flatten packages, leaving class names without one. Those are only
# unambiguous in a complete "<source> cannot be cast to <target>" value. Either
# operand may still be dotted, since a keep rule can preserve one of the two.
# Array suffixes are captured separately so Symbolicator receives only the base
# class names, then reattached when rebuilding the message.
_CLASS_CAST_MESSAGE_RE = re.compile(
    r"(?P<from_class>[A-Za-z_$][\w$.]*)(?P<from_array_suffix>(?:\[\])*) cannot be cast to "
    r"(?P<to_class>[A-Za-z_$][\w$.]*)(?P<to_array_suffix>(?:\[\])*)"
)


class Exceptions:
    def __init__(self, data: Any):
        self._processable_exceptions: list[dict[str, Any]] = []
        self._processable_exceptions_with_values: list[tuple[Any, list[Any]]] = []

        for exc in get_path(data, "exception", "values", filter=True, default=()):
            if exc.get("type", None):
                self._processable_exceptions.append(exc)
            if value := exc.get("value", None):
                if match := _CLASS_CAST_MESSAGE_RE.fullmatch(value):
                    class_matches = list(match.group("from_class", "to_class"))
                else:
                    class_matches = _JAVA_CLASS_IN_TEXT_RE.findall(value)
                if class_matches:
                    self._processable_exceptions_with_values.append((exc, class_matches))

    def get_processable_exceptions(self):
        return self._processable_exceptions

    def get_exception_class_names(self):
        """
        Returns a flattened list of all class names found in the exception values.
        """
        return [
            _strip_quotes(class_name)
            for _, class_names in self._processable_exceptions_with_values
            for class_name in class_names
        ]

    def get_processable_exceptions_with_values(self):
        return self._processable_exceptions_with_values

    def deobfuscate_and_save(
        self, classes: dict[str, str] | None, mapped_exceptions: list[dict[str, Any]]
    ):
        """
        Deobfuscates all exception values, module and type in-place
        """
        # Deobfuscate exception module and type first
        for raw_exc, exc in zip(self._processable_exceptions, mapped_exceptions):
            raw_exc["raw_module"] = raw_exc.get("module")
            raw_exc["raw_type"] = raw_exc.get("type")
            raw_exc["module"] = exc["module"]
            raw_exc["type"] = exc["type"]

        # Deobfuscate exception values
        # Note: operate on a local copy to avoid partial replacements preventing subsequent matches.
        # Replace longer tokens first to avoid overlapping replacements (e.g., a.b$c$1 vs a.b$c).
        if classes:
            for exc, class_names in self._processable_exceptions_with_values:
                original_value = exc["value"]

                if mapped_value := _deobfuscate_class_cast_message(original_value, classes):
                    exc["raw_value"] = original_value
                    exc["value"] = mapped_value
                    continue

                new_value = original_value

                # Preserve order but ensure uniqueness, then sort by stripped length desc
                unique_tokens = list(dict.fromkeys(class_names))
                unique_tokens.sort(key=lambda t: len(_strip_quotes(t)), reverse=True)

                performed_replacement = False
                for class_name in unique_tokens:
                    mapped_class_name = classes.get(class_name) or classes.get(
                        _strip_quotes(class_name)
                    )
                    if not mapped_class_name:
                        continue

                    if not performed_replacement:
                        # Set once if any replacement is performed
                        exc["raw_value"] = original_value
                        performed_replacement = True

                    replacement = _wrap_with_same_quotes(class_name, mapped_class_name)
                    new_value = new_value.replace(class_name, replacement)

                if performed_replacement:
                    exc["value"] = new_value


def _deobfuscate_class_cast_message(value: str, classes: Mapping[str, str]) -> str | None:
    match = _CLASS_CAST_MESSAGE_RE.fullmatch(value)
    if not match:
        return None

    from_class = match["from_class"]
    to_class = match["to_class"]
    mapped_from_class = classes.get(from_class)
    mapped_to_class = classes.get(to_class)
    if not mapped_from_class and not mapped_to_class:
        return None

    return (
        f"{mapped_from_class or from_class}{match['from_array_suffix']} cannot be cast to "
        f"{mapped_to_class or to_class}{match['to_array_suffix']}"
    )


def _is_quoted(token: str) -> bool:
    return len(token) >= 2 and ((token[0] == token[-1] == "'") or (token[0] == token[-1] == '"'))


def _strip_quotes(token: str) -> str:
    return token[1:-1] if _is_quoted(token) else token


def _wrap_with_same_quotes(original_token: str, replacement: str) -> str:
    if _is_quoted(original_token):
        quote = original_token[0]
        return f"{quote}{replacement}{quote}"
    return replacement
