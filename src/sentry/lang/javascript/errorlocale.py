import os
import re

from sentry.utils.safe import get_path

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "../../data/error-locale")
TARGET_LOCALE = "en-US"

translation_lookup_table = set()
target_locale_lookup_table = dict()


def populate_target_locale_lookup_table():
    for locale in os.listdir(LOCALES_DIR):
        fn = os.path.join(LOCALES_DIR, locale)
        if not os.path.isfile(fn):
            continue

        with open(fn, encoding="utf-8") as f:
            for line in f:
                key, translation = line.split(",", 1)
                translation = translation.strip()

                if TARGET_LOCALE in locale:
                    target_locale_lookup_table[key] = translation
                else:
                    translation_regexp = re.escape(translation)
                    translation_regexp = translation_regexp.replace(
                        r"\%s", r"(?P<format_string_data>[a-zA-Z0-9-_\$]+)"
                    )
                    # Some errors are substrings of more detailed ones, so we need exact match
                    translation_regexp = re.compile("^" + translation_regexp + "$")
                    translation_lookup_table.add((translation_regexp, key))


def find_translation(message):
    if not target_locale_lookup_table:
        populate_target_locale_lookup_table()

    for translation in translation_lookup_table:
        translation_regexp, key = translation
        match = translation_regexp.search(message)

        if match is not None:
            format_string_data = match.groupdict().get("format_string_data")

            if format_string_data is None:
                return [key, None]
            else:
                return [key, format_string_data]

    return [None, None]


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
        type = match.groupdict().get("type")
        message = match.groupdict().get("message")

    translation, format_string_data = find_translation(message)

    if translation is None:
        return original_message
    else:
        translated_message = target_locale_lookup_table.get(translation, original_message)

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
