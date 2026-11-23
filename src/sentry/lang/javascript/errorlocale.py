import functools
import os
import re
from collections import defaultdict
from collections.abc import Iterable, Mapping, MutableMapping
from typing import Any, NamedTuple

from sentry.utils.safe import get_path

_LOCALES_DIR = os.path.join(os.path.dirname(__file__), "../../data/error-locale")
_TARGET_LOCALE = "en-US.txt"

_PLACEHOLDER = "%s"
# What a placeholder may stand for in a message.
_FORMAT_STRING_DATA_RE = re.compile(r"[a-zA-Z0-9-_\$]+")
# Placeholder translations are bucketed by this many characters of their literal text.
_ANCHOR_LEN = 3


@functools.cache
def target_locale_lookup_table() -> Mapping[str, str]:
    ret = {}
    with open(os.path.join(_LOCALES_DIR, _TARGET_LOCALE), encoding="utf-8") as f:
        for line in f:
            key, translation = line.split(",", 1)
            translation = translation.strip()
            ret[key] = translation
    return ret


def _load_translations() -> list[tuple[str, str]]:
    """(key, translation) for every line of the non-target locale files.

    When a message matches more than one translation, the one that comes first
    here wins. Locales are sorted so that this doesn't depend on directory
    listing order.
    """
    ret = []
    for locale in sorted(os.listdir(_LOCALES_DIR)):
        if locale == _TARGET_LOCALE:
            continue
        fn = os.path.join(_LOCALES_DIR, locale)
        if not os.path.isfile(fn):
            continue

        with open(fn, encoding="utf-8") as f:
            for line in f:
                key, translation = line.split(",", 1)
                ret.append((key, translation.strip()))
    return ret


class _Pattern(NamedTuple):
    """A translation containing a placeholder: prefix + "%s" + suffix."""

    order: int
    key: str
    prefix: str
    suffix: str

    def match(self, message: str) -> str | None:
        """Return what the placeholder stands for if `message` matches, else None."""
        if message.startswith(self.prefix) and message.endswith(self.suffix):
            data = message[len(self.prefix) : len(message) - len(self.suffix)]
            if _FORMAT_STRING_DATA_RE.fullmatch(data):
                return data
        return None


class _TranslationIndex:
    """Finds the first translation that matches a whole message.

    Equivalent to trying each translation in order as an anchored regex, but
    only looks at translations that could match: an exact-text dict for
    translations without a placeholder, and buckets keyed by the first (or,
    failing that, last) few literal characters for those with one.
    """

    def __init__(self, translations: Iterable[tuple[str, str]]) -> None:
        # text -> (order, key) of its first occurrence
        self.exact: dict[str, tuple[int, str]] = {}
        # Each bucket is sorted by order.
        self.by_prefix: defaultdict[str, list[_Pattern]] = defaultdict(list)
        self.by_suffix: defaultdict[str, list[_Pattern]] = defaultdict(list)
        # Patterns whose prefix and suffix are both too short to bucket by.
        self.unanchored: list[_Pattern] = []

        seen_patterns: set[str] = set()
        for order, (key, translation) in enumerate(translations):
            if _PLACEHOLDER not in translation:
                self.exact.setdefault(translation, (order, key))
                continue
            # A later copy of the same pattern can never win.
            if translation in seen_patterns:
                continue
            seen_patterns.add(translation)

            # Fails, as the old regex compilation did, on more than one placeholder.
            prefix, suffix = translation.split(_PLACEHOLDER)
            pattern = _Pattern(order, key, prefix, suffix)
            if len(prefix) >= _ANCHOR_LEN:
                self.by_prefix[prefix[:_ANCHOR_LEN]].append(pattern)
            elif len(suffix) >= _ANCHOR_LEN:
                self.by_suffix[suffix[-_ANCHOR_LEN:]].append(pattern)
            else:
                self.unanchored.append(pattern)

    def find(self, message: str) -> tuple[str, str | None] | tuple[None, None]:
        # Translations used to be matched as `^...$` regexes, and `$` also
        # matches right before a trailing newline.
        if message.endswith("\n"):
            message = message[:-1]

        best: tuple[int, str, str | None] | None = None
        exact = self.exact.get(message)
        if exact is not None:
            best = (*exact, None)

        for bucket in (
            self.by_prefix.get(message[:_ANCHOR_LEN], ()),
            self.by_suffix.get(message[-_ANCHOR_LEN:], ()),
            self.unanchored,
        ):
            for pattern in bucket:
                # Buckets are sorted by order, so once past the best match so
                # far, nothing left in this bucket can win.
                if best is not None and pattern.order > best[0]:
                    break
                format_string_data = pattern.match(message)
                if format_string_data is not None:
                    best = (pattern.order, pattern.key, format_string_data)

        if best is None:
            return (None, None)
        return (best[1], best[2])


@functools.cache
def _translation_index() -> _TranslationIndex:
    return _TranslationIndex(_load_translations())


def find_translation(message: str) -> tuple[str, str | None] | tuple[None, None]:
    return _translation_index().find(message)


def format_message(message: str, data: str) -> str:
    return message.replace("%s", data)


message_type_regexp = re.compile("^(?P<type>[a-zA-Z]*Error): (?P<message>.*)")


def translate_message(original_message: object) -> object:
    if not isinstance(original_message, str):
        return original_message

    type = None
    message = original_message.strip()

    # Handle both cases. Just a message and message preceded with error type
    # eg. `ReferenceError: foo`, `TypeError: bar`
    match = message_type_regexp.search(message)

    if match is not None:
        type = match["type"]
        message = match["message"]

    translation, format_string_data = find_translation(message)

    if translation is None:
        return original_message
    else:
        translated_message = target_locale_lookup_table().get(translation, original_message)

        if type is not None:
            translated_message = type + ": " + translated_message

        if format_string_data is None:
            return translated_message
        else:
            return format_message(translated_message, format_string_data)


def translate_exception(data: MutableMapping[str, Any]) -> MutableMapping[str, Any]:
    message = get_path(data, "logentry", "message")
    if message:
        data["logentry"]["message"] = translate_message(message)

    formatted = get_path(data, "logentry", "formatted")
    if formatted:
        data["logentry"]["formatted"] = translate_message(formatted)

    for entry in get_path(data, "exception", "values", filter=True, default=()):
        if "value" in entry:
            entry["value"] = translate_message(entry["value"])

    return data
