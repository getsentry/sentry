import pytest
from django.core.exceptions import ValidationError

from sentry.db.models.fields.slug import SentryOrgSlugField, SentrySlugField
from sentry.testutils.cases import TestCase


class TestSentrySlugField(TestCase):
    def setUp(self) -> None:
        self.field = SentrySlugField()

    def test_combination_of_numeric_and_non_numeric(self) -> None:
        # Valid slug value should not raise a ValidationError
        self.field.run_validators("49dk20sk5-34fas")

    def test_non_numeric(self) -> None:
        self.field.run_validators("abc")

    def test_numeric(self) -> None:
        # Numeric value should raise a ValidationError
        with pytest.raises(ValidationError):
            self.field.run_validators("123")

    def test_capitalized(self) -> None:
        with pytest.raises(ValidationError):
            self.field.run_validators("rjkl29FRJF-dh439")

    def test_underscore(self) -> None:
        self.field.run_validators("sdjkh2390_dhj3290-")


class TestSentryOrgSlugField(TestCase):
    def setUp(self) -> None:
        self.field = SentryOrgSlugField()

    def test_valid_value(self) -> None:
        self.field.run_validators("valid-123-slug")

    def test_hyphen_at_end(self) -> None:
        with pytest.raises(ValidationError):
            self.field.run_validators("not-123-valid-")

    def test_start_with_special_character(self) -> None:
        with pytest.raises(ValidationError):
            self.field.run_validators("!1Not-valid")

    def test_with_underscore(self) -> None:
        with pytest.raises(ValidationError):
            self.field.run_validators("dfj49_29dFJ")
