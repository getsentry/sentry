import pytest
from django.core.exceptions import ValidationError

from sentry.db.models.fields.slug import NoNumericValidator
from sentry.testutils.cases import TestCase


class TestCall(TestCase):
    def setUp(self):
        self.validator = NoNumericValidator()

    def test_non_numeric_value(self) -> None:
        self.assertIsNone(self.validator("abc"))

    def test_numeric_value(self) -> None:
        with pytest.raises(ValidationError):
            self.validator("123")

    def test_combination_of_numeric_and_non_numeric_values(self) -> None:
        self.assertIsNone(self.validator("49dk20sk5"))

    def test_emtpy_value(self) -> None:
        self.assertIsNone(self.validator(""))
