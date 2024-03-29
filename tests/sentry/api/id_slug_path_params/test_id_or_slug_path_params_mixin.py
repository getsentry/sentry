from typing import Any

from pytest import fixture

from sentry.testutils.helpers.options import override_options


class APIIdOrSlugTestMixin:
    slug_mappings: dict[str, Any]
    reverse_slug_mappings: dict[str, Any]
    incident: Any
    code_mapping: Any
    incident_activity: Any

    @fixture(autouse=True)
    def _activate_id_or_slug_path_params(self):
        with override_options({"api.id-or-slug-enabled": True}):
            yield

    @property
    def no_slugs_in_kwargs_allowlist(self):
        return {}

    def ignore_test(self, *args):
        pass

    def assert_objects(
        self, converted_slugs, converted_ids, reverse_non_slug_mappings=None
    ) -> None:
        if reverse_non_slug_mappings:
            assert all(
                converted_slugs[key] == self.reverse_slug_mappings.get(key)
                or converted_slugs[key] == reverse_non_slug_mappings[key]
                for key in converted_slugs
            )
            assert all(
                converted_ids[key] == self.reverse_slug_mappings.get(key)
                or converted_slugs[key] == reverse_non_slug_mappings[key]
                for key in converted_ids
            )
        else:
            assert all(
                converted_slugs[key] == self.reverse_slug_mappings.get(key)
                for key in converted_slugs
            )
            assert all(
                converted_ids[key] == self.reverse_slug_mappings.get(key) for key in converted_ids
            )

    def assert_ids(self, converted_slugs, converted_ids, reverse_non_slug_mappings=None) -> None:
        if reverse_non_slug_mappings:
            for key, value in converted_slugs.items():
                correct_mapping = self.reverse_slug_mappings.get(
                    key, reverse_non_slug_mappings[key]
                )
                assert value.id == correct_mapping.id

            for key, value in converted_ids.items():
                correct_mapping = self.reverse_slug_mappings.get(
                    key, reverse_non_slug_mappings[key]
                )
                assert value.id == correct_mapping.id

        else:
            assert all(
                converted_slugs[key].id == self.reverse_slug_mappings[key].id
                for key in converted_slugs
            )
            assert all(
                converted_ids[key].id == self.reverse_slug_mappings[key].id for key in converted_ids
            )

    def assert_conversion(
        self,
        endpoint_class,
        converted_slugs,
        converted_ids,
        reverse_non_slug_mappings=None,
        use_id=False,
    ) -> None:
        check_no_slugs_in_kwargs = (
            endpoint_class.convert_args not in self.no_slugs_in_kwargs_allowlist
        )
        if check_no_slugs_in_kwargs:
            assert not any(str.endswith(param, "_slug") for param in converted_ids)

        assert converted_slugs == converted_ids

        if use_id:
            self.assert_ids(converted_slugs, converted_ids, reverse_non_slug_mappings)
        else:
            self.assert_objects(converted_slugs, converted_ids, reverse_non_slug_mappings)
