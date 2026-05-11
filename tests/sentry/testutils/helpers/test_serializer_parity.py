import pytest

from sentry.testutils.helpers.serializer_parity import assert_serializer_parity


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
