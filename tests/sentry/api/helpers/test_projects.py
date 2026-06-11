import pytest
from rest_framework import serializers

from sentry.api.helpers.projects import ProjectIdOrSlugField, parse_id_or_slug_params


class TestParseIdOrSlugParams:
    def test_empty_input(self) -> None:
        params = parse_id_or_slug_params([])
        assert params.ids == set()
        assert params.slugs == set()

    def test_numeric_values(self) -> None:
        params = parse_id_or_slug_params(["1", "2", "3"])
        assert params.ids == {1, 2, 3}
        assert params.slugs == set()

    def test_slug_values(self) -> None:
        params = parse_id_or_slug_params(["my-project", "another-proj"])
        assert params.ids == set()
        assert params.slugs == {"my-project", "another-proj"}

    def test_mixed_values(self) -> None:
        params = parse_id_or_slug_params(["1", "my-project", 42])
        assert params.ids == {1, 42}
        assert params.slugs == {"my-project"}

    def test_empty_values_are_skipped(self) -> None:
        params = parse_id_or_slug_params(["", None, "1", "foo"])
        assert params.ids == {1}
        assert params.slugs == {"foo"}

    def test_negative_numbers_are_ids(self) -> None:
        params = parse_id_or_slug_params(["-1"])
        assert params.ids == {-1}
        assert params.slugs == set()

    def test_all_access_sigil_is_slug(self) -> None:
        params = parse_id_or_slug_params(["$all"])
        assert params.ids == set()
        assert params.slugs == {"$all"}

    def test_detects_all_access_sentinels(self) -> None:
        assert parse_id_or_slug_params(["-1"]).has_all_projects_sentinel
        assert parse_id_or_slug_params(["$all"]).has_all_projects_sentinel
        assert not parse_id_or_slug_params(["1", "my-project"]).has_all_projects_sentinel

    def test_deduplication(self) -> None:
        params = parse_id_or_slug_params(["1", "1", "foo", "foo"])
        assert params.ids == {1}
        assert params.slugs == {"foo"}


class TestProjectIdOrSlugField:
    def test_accepts_ids_and_slugs(self) -> None:
        field = ProjectIdOrSlugField()
        assert field.to_internal_value("1") == 1
        assert field.to_internal_value(2) == 2
        assert field.to_internal_value("my-project") == "my-project"

    def test_rejects_invalid_slug(self) -> None:
        field = ProjectIdOrSlugField()

        with pytest.raises(serializers.ValidationError) as error:
            field.to_internal_value("foo bar")

        assert "Enter a valid slug" in str(error.value)
