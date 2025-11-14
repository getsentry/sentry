from typing import int
import functools
import os
import re
from collections.abc import Mapping

from sentry.utils.safe import get_path

_LOCALES_DIR = os.path.join(os.path.dirname(__file__), "../../data/error-locale")
_TARGET_LOCALE = "en-US.txt"


@functools.cache
def target_locale_lookup_table() -> Mapping[str, str]:
    ret = {}
    with open(os.path.join(_LOCALES_DIR, _TARGET_LOCALE), encoding="utf-8") as f:
        for line in f:
            key, translation = line.split(",", 1)
            translation = translation.strip()
            ret[key] = translation
    return ret


@functools.cache
def translation_lookup_table() -> tuple[tuple[re.Pattern[str], str], ...]:
    ret = []
    for locale in os.listdir(_LOCALES_DIR):
        if locale == _TARGET_LOCALE:
            continue
        fn = os.path.join(_LOCALES_DIR, locale)
        if not os.path.isfile(fn):
            continue

        with open(fn, encoding="utf-8") as f:
            for line in f:
                key, translation = line.split(",", 1)
                translation = translation.strip()

                translation_regexp = re.escape(translation)
                translation_regexp = translation_regexp.replace(
                    r"%s", r"(?P<format_string_data>[a-zA-Z0-9-_\$]+)"
                )
                # Some errors are substrings of more detailed ones, so we need exact match
                translation_regexp_re = re.compile(f"^{translation_regexp}$")
                ret.append((translation_regexp_re, key))
    return tuple(ret)


def find_translation(message: str) -> tuple[str, str | None] | tuple[None, None]:
    for translation in translation_lookup_table():
        translation_regexp, key = translation
        match = translation_regexp.search(message)

        if match is not None:
            format_string_data = match.groupdict().get("format_string_data")
            return (key, format_string_data)

    return (None, None)


def format_message(message, data):
    return message.replace("%s", data)


message_type_regexp = re.compile("^(?P<type>[a-zA-Z]*Error): (?P<message>.*)")


def translate_message(original_message):
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


def translate_exception(data):
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
