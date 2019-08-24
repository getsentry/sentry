from __future__ import absolute_import, unicode_literals

from copy import deepcopy

from sentry.lang.javascript.errorlocale import translate_message, translate_exception
from unittest import TestCase


class ErrorLocaleTest(TestCase):
    def test_basic_translation(self):
        actual = "Type mismatch"
        expected = translate_message("Typenkonflikt")
        assert actual == expected

    def test_unicode_translation(self):
        expected = "Division by zero"
        actual = translate_message("Divisi\xf3n por cero")
        assert actual == expected

    def test_same_translation(self):
        expected = "Out of memory"
        actual = translate_message("Out of memory")
        assert actual == expected

    def test_unknown_translation(self):
        expected = "Some unknown message"
        actual = translate_message("Some unknown message")
        assert actual == expected

    def test_translation_with_type(self):
        expected = "RangeError: Subscript out of range"
        actual = translate_message("RangeError: Indeks poza zakresem")
        assert actual == expected

    def test_translation_with_type_and_colon(self):
        expected = "RangeError: Cannot define property: object is not extensible"
        actual = translate_message(
            "RangeError: Nie mo\u017cna zdefiniowa\u0107 w\u0142a\u015bciwo\u015bci: obiekt nie jest rozszerzalny"
        )
        assert actual == expected

    def test_interpolated_translation(self):
        expected = "Type 'foo' not found"
        actual = translate_message("Nie odnaleziono typu \u201efoo\u201d")
        assert actual == expected

    def test_interpolated_translation_with_colon(self):
        expected = "'this' is not of expected type: foo"
        actual = translate_message(
            "Typ obiektu \u201ethis\u201d jest inny ni\u017c oczekiwany: foo"
        )
        assert actual == expected

    def test_interpolated_translation_with_colon_in_front(self):
        expected = "foo: an unexpected failure occurred while trying to obtain metadata information"
        actual = translate_message(
            "foo: wyst\u0105pi\u0142 nieoczekiwany b\u0142\u0105d podczas pr\xf3by uzyskania informacji o metadanych"
        )
        assert actual == expected

    def test_interpolated_translation_with_type(self):
        expected = "TypeError: Type 'foo' not found"
        actual = translate_message("TypeError: Nie odnaleziono typu \u201efoo\u201d")
        assert actual == expected

    def test_interpolated_translation_with_type_and_colon(self):
        expected = "ReferenceError: Cannot modify property 'foo': 'length' is not writable"
        actual = translate_message(
            "ReferenceError: Nie mo\u017cna zmodyfikowa\u0107 w\u0142a\u015bciwo\u015bci \u201efoo\u201d: warto\u015b\u0107 \u201elength\u201d jest niezapisywalna"
        )
        assert actual == expected

    def test_translate_exception(self):
        data = {
            "logentry": {"message": "Typenkonflikt", "formatted": "Typenkonflikt"},
            "exception": {"values": [{"value": "Typenkonflikt"}, {"value": "Typenkonflikt"}]},
        }

        translate_exception(data)
        assert data == {
            "logentry": {"message": "Type mismatch", "formatted": "Type mismatch"},
            "exception": {"values": [{"value": "Type mismatch"}, {"value": "Type mismatch"}]},
        }

    def test_translate_exception_missing(self):
        data = {}
        translate_exception(data)
        assert data == {}

    def test_translate_exception_none(self):
        expected = {
            "logentry": {"message": None, "formatted": None},
            "exception": {"values": [None, {"value": None}]},
        }

        actual = deepcopy(expected)
        translate_exception(actual)
        assert actual == expected
