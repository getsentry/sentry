import pytest
from rest_framework.exceptions import ValidationError

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.db.models.fields.bounded import BoundedBigAutoField
from sentry.workflow_engine.endpoints.utils.ids import to_valid_int_id, to_valid_int_id_list


class TestToValidIntId:
    def test_valid_integer_input(self) -> None:
        assert to_valid_int_id("test_id", 123) == 123

    def test_valid_string_input(self) -> None:
        assert to_valid_int_id("test_id", "456") == 456

    def test_zero_is_valid(self) -> None:
        assert to_valid_int_id("test_id", 0) == 0
        assert to_valid_int_id("test_id", "0") == 0

    def test_negative_numbers_are_invalid(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", -1)
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "-1")
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

    def test_max_value_boundary(self) -> None:
        max_val = BoundedBigAutoField.MAX_VALUE
        assert to_valid_int_id("test_id", max_val) == max_val
        assert to_valid_int_id("test_id", str(max_val)) == max_val

    def test_exceeds_max_value(self) -> None:
        too_large = BoundedBigAutoField.MAX_VALUE + 1
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", too_large)
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", str(too_large))
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

    def test_non_numeric_string(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "not_a_number")
        assert isinstance(exc_info.value.detail, dict)
        assert "test_id" in exc_info.value.detail
        assert "not a valid integer id" in exc_info.value.detail["test_id"]

    def test_empty_string(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "")
        assert "test_id" in exc_info.value.detail

    def test_float_string(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("test_id", "123.45")
        assert "test_id" in exc_info.value.detail

    def test_field_name_in_error(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("projectId", "invalid")
        assert "projectId" in exc_info.value.detail

        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id("detectorId", -1)
        assert "detectorId" in exc_info.value.detail

    def test_raise_404_on_non_numeric_string(self) -> None:
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", "not_a_number", raise_404=True)

    def test_raise_404_on_negative_number(self) -> None:
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", -1, raise_404=True)

        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", "-1", raise_404=True)

    def test_raise_404_on_exceeds_max_value(self) -> None:
        too_large = BoundedBigAutoField.MAX_VALUE + 1
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", too_large, raise_404=True)

        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", str(too_large), raise_404=True)

    def test_raise_404_on_empty_string(self) -> None:
        with pytest.raises(ResourceDoesNotExist):
            to_valid_int_id("test_id", "", raise_404=True)

    def test_raise_404_valid_input_still_works(self) -> None:
        assert to_valid_int_id("test_id", 123, raise_404=True) == 123
        assert to_valid_int_id("test_id", "456", raise_404=True) == 456
        assert to_valid_int_id("test_id", 0, raise_404=True) == 0


class TestToValidIntIdList:
    def test_empty_list(self) -> None:
        assert to_valid_int_id_list("test_ids", []) == []

    def test_valid_integer_list(self) -> None:
        assert to_valid_int_id_list("test_ids", [1, 2, 3]) == [1, 2, 3]

    def test_valid_string_list(self) -> None:
        assert to_valid_int_id_list("test_ids", ["1", "2", "3"]) == [1, 2, 3]

    def test_mixed_string_and_int_list(self) -> None:
        assert to_valid_int_id_list("test_ids", [1, "2", 3, "4"]) == [1, 2, 3, 4]

    def test_list_with_zero(self) -> None:
        assert to_valid_int_id_list("test_ids", [0, 1, 2]) == [0, 1, 2]
        assert to_valid_int_id_list("test_ids", ["0", "1", "2"]) == [0, 1, 2]

    def test_list_with_invalid_value(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id_list("test_ids", [1, "invalid", 3])
        assert "test_ids" in exc_info.value.detail

    def test_list_with_negative_value(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id_list("test_ids", [1, -2, 3])
        assert "test_ids" in exc_info.value.detail

    def test_list_with_value_exceeding_max(self) -> None:
        too_large = BoundedBigAutoField.MAX_VALUE + 1
        with pytest.raises(ValidationError) as exc_info:
            to_valid_int_id_list("test_ids", [1, too_large, 3])
        assert "test_ids" in exc_info.value.detail

    def test_list_fails_on_first_invalid(self) -> None:
        # Should fail on the first invalid value encountered
        with pytest.raises(ValidationError):
            to_valid_int_id_list("test_ids", ["invalid", "also_invalid"])

    def test_list_with_max_boundary_value(self) -> None:
        max_val = BoundedBigAutoField.MAX_VALUE
        result = to_valid_int_id_list("test_ids", [1, max_val, 100])
        assert result == [1, max_val, 100]
