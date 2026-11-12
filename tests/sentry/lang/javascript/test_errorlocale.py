from __future__ import annotations

import os
import re
from collections.abc import Iterable
from copy import deepcopy
from typing import Any
from unittest import TestCase, mock

import pytest

from sentry.lang.javascript import errorlocale
from sentry.lang.javascript.errorlocale import (
    _TranslationIndex,
    find_translation,
    translate_exception,
    translate_message,
)


class ErrorLocaleTest(TestCase):
    def test_basic_translation(self) -> None:
        actual = "Type mismatch"
        expected = translate_message("Typenkonflikt")
        assert actual == expected

    def test_unicode_translation(self) -> None:
        expected = "Division by zero"
        actual = translate_message("Divisi\xf3n por cero")
        assert actual == expected

    def test_same_translation(self) -> None:
        expected = "Out of memory"
        actual = translate_message("Out of memory")
        assert actual == expected

    def test_unknown_translation(self) -> None:
        expected = "Some unknown message"
        actual = translate_message("Some unknown message")
        assert actual == expected

    def test_translation_with_type(self) -> None:
        expected = "RangeError: Subscript out of range"
        actual = translate_message("RangeError: Indeks poza zakresem")
        assert actual == expected

    def test_translation_with_type_and_colon(self) -> None:
        expected = "RangeError: Cannot define property: object is not extensible"
        actual = translate_message(
            "RangeError: Nie mo\u017cna zdefiniowa\u0107 w\u0142a\u015bciwo\u015bci: obiekt nie jest rozszerzalny"
        )
        assert actual == expected

    def test_interpolated_translation(self) -> None:
        expected = "Type 'foo' not found"
        actual = translate_message("Nie odnaleziono typu \u201efoo\u201d")
        assert actual == expected

    def test_interpolated_translation_with_colon(self) -> None:
        expected = "'this' is not of expected type: foo"
        actual = translate_message(
            "Typ obiektu \u201ethis\u201d jest inny ni\u017c oczekiwany: foo"
        )
        assert actual == expected

    def test_interpolated_translation_with_colon_in_front(self) -> None:
        expected = "foo: an unexpected failure occurred while trying to obtain metadata information"
        actual = translate_message(
            "foo: wyst\u0105pi\u0142 nieoczekiwany b\u0142\u0105d podczas pr\xf3by uzyskania informacji o metadanych"
        )
        assert actual == expected

    def test_interpolated_translation_with_type(self) -> None:
        expected = "TypeError: Type 'foo' not found"
        actual = translate_message("TypeError: Nie odnaleziono typu \u201efoo\u201d")
        assert actual == expected

    def test_interpolated_translation_with_type_and_colon(self) -> None:
        expected = "ReferenceError: Cannot modify property 'foo': 'length' is not writable"
        actual = translate_message(
            "ReferenceError: Nie mo\u017cna zmodyfikowa\u0107 w\u0142a\u015bciwo\u015bci \u201efoo\u201d: warto\u015b\u0107 \u201elength\u201d jest niezapisywalna"
        )
        assert actual == expected

    def test_translate_exception(self) -> None:
        data = {
            "logentry": {"message": "Typenkonflikt", "formatted": "Typenkonflikt"},
            "exception": {"values": [{"value": "Typenkonflikt"}, {"value": "Typenkonflikt"}]},
        }

        translate_exception(data)
        assert data == {
            "logentry": {"message": "Type mismatch", "formatted": "Type mismatch"},
            "exception": {"values": [{"value": "Type mismatch"}, {"value": "Type mismatch"}]},
        }

    def test_translate_exception_missing(self) -> None:
        data: dict[str, Any] = {}
        translate_exception(data)
        assert data == {}

    def test_translate_exception_none(self) -> None:
        expected = {
            "logentry": {"message": None, "formatted": None},
            "exception": {"values": [None, {"value": None}]},
        }

        actual = deepcopy(expected)
        translate_exception(actual)
        assert actual == expected


class SequentialReference:
    """The original lookup, kept as a reference for the index: compile each
    translation into an anchored regex and return the first one that matches."""

    def __init__(self, translations: Iterable[tuple[str, str]]) -> None:
        self.table = []
        for key, translation in translations:
            translation_regexp = re.escape(translation)
            translation_regexp = translation_regexp.replace(
                r"%s", r"(?P<format_string_data>[a-zA-Z0-9-_\$]+)"
            )
            self.table.append((re.compile(f"^{translation_regexp}$"), key))

    def find(self, message: str) -> tuple[str, str | None] | tuple[None, None]:
        for translation_regexp, key in self.table:
            match = translation_regexp.search(message)
            if match is not None:
                return (key, match.groupdict().get("format_string_data"))
        return (None, None)


def load_locale_files() -> list[tuple[str, str]]:
    """The original loading loop, with locales in sorted order."""
    ret = []
    for locale in sorted(os.listdir(errorlocale._LOCALES_DIR)):
        if locale == errorlocale._TARGET_LOCALE:
            continue
        with open(os.path.join(errorlocale._LOCALES_DIR, locale), encoding="utf-8") as f:
            for line in f:
                key, translation = line.split(",", 1)
                ret.append((key, translation.strip()))
    return ret


@pytest.fixture(scope="module")
def translations() -> list[tuple[str, str]]:
    return load_locale_files()


@pytest.fixture(scope="module")
def reference(translations: list[tuple[str, str]]) -> SequentialReference:
    return SequentialReference(translations)


def test_load_translations_reads_locales_in_sorted_order(
    translations: list[tuple[str, str]],
) -> None:
    assert errorlocale._load_translations() == translations


def test_every_translation_matches_like_sequential_reference(
    translations: list[tuple[str, str]], reference: SequentialReference
) -> None:
    # A message for every entry, with its placeholder (if any) filled in by a
    # plain word and by every kind of character the placeholder accepts.
    messages = sorted(
        {
            translation.replace("%s", data)
            for _, translation in translations
            for data in ("foo", "a-Z_$9")
        }
    )
    results = [find_translation(message) for message in messages]

    assert len(messages) > 8000
    assert (None, None) not in results
    mismatches = [
        (message, result, reference.find(message))
        for message, result in zip(messages, results)
        if result != reference.find(message)
    ]
    assert mismatches == []


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        # English messages, which most events have, match nothing.
        ("Cannot read properties of undefined (reading 'foo')", (None, None)),
        ("foo is not a function", (None, None)),
        ("Script error.", (None, None)),
        ("", (None, None)),
        ("a", (None, None)),
        # Translations without a placeholder.
        ("Typenkonflikt", ("13", None)),
        ("Divisi\xf3n por cero", ("11", None)),
        # Placeholder at the start, middle and end.
        (
            "foo: wystąpił nieoczekiwany błąd podczas pr\xf3by uzyskania informacji o metadanych",
            ("15112", "foo"),
        ),
        ("Nie odnaleziono typu „foo”", ("15101", "foo")),
        ("Typ obiektu „this” jest inny niż oczekiwany: foo", ("15110", "foo")),
        # Everything the placeholder accepts, and things it doesn't.
        ("Typ obiektu „this” jest inny niż oczekiwany: a-Z_$9", ("15110", "a-Z_$9")),
        ("Typ obiektu „this” jest inny niż oczekiwany: fo.o", (None, None)),
        ("Typ obiektu „this” jest inny niż oczekiwany: f\xf3o", (None, None)),
        ("Typ obiektu „this” jest inny niż oczekiwany: ", (None, None)),
        ("Typ obiektu „this” jest inny niż oczekiwany: %s", (None, None)),
        ("Nie odnaleziono typu „%s”", (None, None)),
        ("%s", (None, None)),
        # Regex metacharacters in a message are plain text.
        (".*", (None, None)),
        ("Typenkonflik.", (None, None)),
        ("^Typenkonflikt$", (None, None)),
        ("Nie odnaleziono typu „.*”", (None, None)),
        # The whole message has to match, except that a single trailing newline
        # is ignored, as `$` ignored it.
        ("Typenkonflikt\n", ("13", None)),
        ("Nie odnaleziono typu „foo”\n", ("15101", "foo")),
        ("Typenkonflikt\n\n", (None, None)),
        ("Typenkonflikt\r\n", (None, None)),
        (" Typenkonflikt", (None, None)),
        ("Typenkonflikt.", (None, None)),
        # Several matching translations: the first one in the locale files wins.
        ("A v\xe1rt elem JavaScript-objektum", ("5014", None)),
        ("'this'에 할당할 수 없습니다.", ("5000", None)),
        ("'foo'에 할당할 수 없습니다.", ("15008", "foo")),
        # pt-BR's exact translation comes before pt-PT's placeholder one.
        ("N\xe3o \xe9 poss\xedvel atribuir a 'this'", ("5000", None)),
        # Untranslated English entries, present in several locales.
        ("'foo' is null or not an object", ("15007", "foo")),
    ],
)
def test_find_translation(
    message: str,
    expected: tuple[str, str | None] | tuple[None, None],
    reference: SequentialReference,
) -> None:
    assert find_translation(message) == expected
    assert reference.find(message) == expected


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("TypeError: Typenkonflikt", "TypeError: Type mismatch"),
        ("Error: Typenkonflikt", "Error: Type mismatch"),
        ("  TypeError: Typenkonflikt \n", "TypeError: Type mismatch"),
        # Only the first line after the error type is translated.
        ("TypeError: Typenkonflikt\n    at foo.js:1:1", "TypeError: Type mismatch"),
        ("TypeError: Typenkonflikt\n", "TypeError: Type mismatch"),
        (
            "TypeError: foo: wystąpił nieoczekiwany błąd podczas pr\xf3by uzyskania informacji o metadanych",
            "TypeError: foo: an unexpected failure occurred while trying to obtain metadata information",
        ),
        ("TypeError: Nie odnaleziono typu „foo”", "TypeError: Type 'foo' not found"),
        (
            "TypeError: Typ obiektu „this” jest inny niż oczekiwany: foo",
            "TypeError: 'this' is not of expected type: foo",
        ),
        ("TypeError: 'foo' is null or not an object", "TypeError: 'foo' is null or not an object"),
        (
            "TypeError: N\xe3o \xe9 poss\xedvel atribuir a 'this'",
            "TypeError: Cannot assign to 'this'",
        ),
        (
            "TypeError: Cannot read properties of undefined (reading 'foo')",
            "TypeError: Cannot read properties of undefined (reading 'foo')",
        ),
        ("TypeError: Typenkonflikt.", "TypeError: Typenkonflikt."),
        ("TypeError:  Typenkonflikt", "TypeError:  Typenkonflikt"),
    ],
)
def test_translate_message_with_error_type(
    message: str, expected: str, reference: SequentialReference
) -> None:
    assert translate_message(message) == expected
    with mock.patch.object(errorlocale, "find_translation", reference.find):
        assert translate_message(message) == expected


@pytest.mark.parametrize(
    ("translations", "message", "expected"),
    [
        # A placeholder translation that comes first beats an exact one, and vice versa.
        (
            [("1", "Cannot assign to '%s'"), ("2", "Cannot assign to 'this'")],
            "Cannot assign to 'this'",
            ("1", "this"),
        ),
        (
            [("2", "Cannot assign to 'this'"), ("1", "Cannot assign to '%s'")],
            "Cannot assign to 'this'",
            ("2", None),
        ),
        # Candidates from the prefix and suffix buckets are compared by order.
        ([("1", "abc%s is broken"), ("2", "ab%s is broken")], "abcx is broken", ("1", "x")),
        ([("2", "ab%s is broken"), ("1", "abc%s is broken")], "abcx is broken", ("2", "cx")),
        # As are candidates within one bucket.
        ([("1", "Can%sx"), ("2", "Cann%sx")], "Cannotx", ("1", "not")),
        ([("2", "Cann%sx"), ("1", "Can%sx")], "Cannotx", ("2", "ot")),
        # Duplicates: the first one wins.
        ([("1", "dup"), ("2", "dup")], "dup", ("1", None)),
        ([("1", "dup %s"), ("2", "dup %s")], "dup x", ("1", "x")),
        ([("1", "x"), ("2", "%s")], "x", ("1", None)),
        ([("2", "%s"), ("1", "x")], "x", ("2", "x")),
        # Prefix and suffix too short to bucket by.
        ([("1", "%s"), ("2", "'%s'")], "foo", ("1", "foo")),
        ([("1", "%s"), ("2", "'%s'")], "'foo'", ("2", "foo")),
        ([("1", "'%s'")], "''", (None, None)),
        # Prefix and suffix may not overlap, and the placeholder can't be empty.
        ([("1", "ab%sba")], "aba", (None, None)),
        ([("1", "ab%sba")], "abba", (None, None)),
        ([("1", "ab%sba")], "abxba", ("1", "x")),
        # Literal text next to the placeholder that it would also accept.
        ([("1", "%s-Objekt")], "foo-bar-Objekt", ("1", "foo-bar")),
        ([("1", "%s-Objekt")], "-Objekt", (None, None)),
        # Regex metacharacters in translations and messages are plain text.
        ([("1", "a.b(%s)*?")], "a.b(foo)*?", ("1", "foo")),
        ([("1", "a.b(%s)*?")], "aXb(foo)*?", (None, None)),
        ([("1", "a.b(%s)*?")], "a.b(f.o)*?", (None, None)),
        ([("1", "[%s]{2}\\d")], "[x]{2}\\d", ("1", "x")),
        ([("1", "[%s]{2}\\d")], "[x]x\\d", (None, None)),
        ([("1", "a|b %s")], "a", (None, None)),
        # A single trailing newline is ignored.
        ([("1", "x %s")], "x foo\n", ("1", "foo")),
        ([("1", "x %s")], "x foo\n\n", (None, None)),
        ([("1", "x %s")], "x \n", (None, None)),
        ([("1", "dup")], "dup\n", ("1", None)),
    ],
)
def test_index_matches_sequential_reference(
    translations: list[tuple[str, str]],
    message: str,
    expected: tuple[str, str | None] | tuple[None, None],
) -> None:
    assert _TranslationIndex(translations).find(message) == expected
    assert SequentialReference(translations).find(message) == expected
