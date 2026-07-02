import pytest

from sentry.testutils.helpers.serializer_parity import assert_serializer_parity
from sentry.utils.payload_comparison import ParityChecker, describe_value


class TestNestedRecursion:
    def test_nested_dict_reports_leaf_path(self) -> None:
        old = {"event": {"event_id": "abc", "level": "error"}}
        new = {"event": {"event_id": "xyz", "level": "error"}}
        checker = ParityChecker(format_value=repr)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["event.event_id: old='abc', new='xyz'"]

    def test_deeply_nested_dict(self) -> None:
        old = {"a": {"b": {"c": "old"}}}
        new = {"a": {"b": {"c": "new"}}}
        checker = ParityChecker(format_value=repr)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["a.b.c: old='old', new='new'"]

    def test_list_length_mismatch(self) -> None:
        old = {"items": [1, 2, 3]}
        new = {"items": [1, 2]}
        checker = ParityChecker(format_value=repr)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["items count: old=3, new=2"]

    def test_list_scalar_element_diff(self) -> None:
        old = {"tags": ["alpha", "beta"]}
        new = {"tags": ["alpha", "gamma"]}
        checker = ParityChecker(format_value=repr)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["tags[1]: old='beta', new='gamma'"]

    def test_list_of_dicts_element_diff(self) -> None:
        old = {"items": [{"name": "a", "val": 1}, {"name": "b", "val": 2}]}
        new = {"items": [{"name": "a", "val": 1}, {"name": "b", "val": 99}]}
        checker = ParityChecker(format_value=repr)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["items[1].val: old=2, new=99"]

    def test_nested_dict_missing_key(self) -> None:
        old = {"event": {"id": "1", "level": "error"}}
        new = {"event": {"id": "1"}}
        checker = ParityChecker(format_value=repr)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["Missing from new: event.level"]

    def test_nested_dict_extra_key(self) -> None:
        old = {"event": {"id": "1"}}
        new = {"event": {"id": "1", "extra": "val"}}
        checker = ParityChecker(format_value=repr)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["Extra in new: event.extra"]

    def test_identical_nested_no_mismatches(self) -> None:
        payload = {"event": {"tags": [["a", "b"]], "level": "error"}}
        checker = ParityChecker(format_value=repr)
        checker.compare(payload, payload, frozenset())
        assert checker.mismatches == []

    def test_format_value_used_in_nested_mismatch(self) -> None:
        old = {"event": {"msg": "hello"}}
        new = {"event": {"msg": "world"}}
        checker = ParityChecker(format_value=describe_value)
        checker.compare(old, new, frozenset())
        assert checker.mismatches == ["event.msg: old=str(len=5), new=str(len=5)"]


class TestUnreliable:
    def test_ignores_difference(self) -> None:
        old = {"id": "1", "name": "a"}
        new = {"id": "2", "name": "a"}
        assert_serializer_parity(old=old, new=new, unreliable={"id"})

    def test_ignores_match(self) -> None:
        old = {"id": "1", "name": "a"}
        new = {"id": "1", "name": "a"}
        assert_serializer_parity(old=old, new=new, unreliable={"id"})

    def test_nested_in_list(self) -> None:
        old = {"items": [{"id": "1", "v": "x"}, {"id": "2", "v": "y"}]}
        new = {"items": [{"id": "99", "v": "x"}, {"id": "100", "v": "y"}]}
        assert_serializer_parity(old=old, new=new, unreliable={"items.id"})

    def test_nested_in_dict(self) -> None:
        old = {"outer": {"id": "1", "v": "x"}}
        new = {"outer": {"id": "2", "v": "x"}}
        assert_serializer_parity(old=old, new=new, unreliable={"outer.id"})

    def test_still_fails_on_other_fields(self) -> None:
        old = {"id": "1", "name": "a"}
        new = {"id": "2", "name": "b"}
        with pytest.raises(AssertionError, match="name"):
            assert_serializer_parity(old=old, new=new, unreliable={"id"})

    def test_fails_if_missing_from_new(self) -> None:
        old = {"id": "1", "name": "a"}
        new = {"name": "a"}
        with pytest.raises(AssertionError, match="Missing from new"):
            assert_serializer_parity(old=old, new=new, unreliable={"id"})

    def test_fails_if_extra_in_new(self) -> None:
        old = {"name": "a"}
        new = {"id": "1", "name": "a"}
        with pytest.raises(AssertionError, match="Extra in new"):
            assert_serializer_parity(old=old, new=new, unreliable={"id"})
