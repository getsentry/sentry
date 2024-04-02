from typing import Any


class APIIdOrSlugTestMixin:
    slug_mappings: dict[str, Any]
    reverse_slug_mappings: dict[str, Any]
    incident: Any
    code_mapping: Any
    incident_activity: Any

    @property
    def no_slugs_in_kwargs_allowlist(self):
        return {}

    def ignore_test(self, *args):
        pass

    def assert_objects(
        self,
        converted_slugs,
        converted_ids,
        check_no_slugs_in_kwargs,
        reverse_non_slug_mappings=None,
    ) -> None:
        if reverse_non_slug_mappings:
            assert all(
                (
                    converted_slugs[key] == self.reverse_slug_mappings.get(key)
                    or converted_slugs[key] == reverse_non_slug_mappings[key]
                )
                for key in converted_slugs
                if check_no_slugs_in_kwargs or not key.endswith("_slug")
            )
            assert all(
                (
                    converted_ids[key] == self.reverse_slug_mappings.get(key)
                    or converted_slugs[key] == reverse_non_slug_mappings[key]
                )
                for key in converted_ids
                if check_no_slugs_in_kwargs or not key.endswith("_slug")
            )
        else:
            assert all(
                converted_slugs[key] == self.reverse_slug_mappings.get(key)
                for key in converted_slugs
                if check_no_slugs_in_kwargs or not key.endswith("_slug")
            )
            assert all(
                converted_ids[key] == self.reverse_slug_mappings.get(key)
                for key in converted_ids
                if check_no_slugs_in_kwargs or not key.endswith("_slug")
            )

    def assert_ids(
        self,
        converted_slugs,
        converted_ids,
        check_no_slugs_in_kwargs,
        reverse_non_slug_mappings=None,
    ) -> None:
        if reverse_non_slug_mappings:
            for key, value in converted_slugs.items():
                if not check_no_slugs_in_kwargs and key.endswith("_slug"):
                    continue

                correct_mapping = self.reverse_slug_mappings.get(
                    key, reverse_non_slug_mappings.get(key)
                )
                assert value.id == correct_mapping.id

            for key, value in converted_ids.items():
                if not check_no_slugs_in_kwargs and key.endswith("_slug"):
                    continue

                correct_mapping = self.reverse_slug_mappings.get(
                    key, reverse_non_slug_mappings.get(key)
                )
                assert value.id == correct_mapping.id

        else:
            for key in converted_slugs:
                if not check_no_slugs_in_kwargs and key.endswith("_slug"):
                    continue

                assert converted_slugs[key].id == self.reverse_slug_mappings[key].id

            for key in converted_ids:
                if not check_no_slugs_in_kwargs and key.endswith("_slug"):
                    continue

                assert converted_ids[key].id == self.reverse_slug_mappings[key].id

    def assert_conversion(
        self,
        endpoint_class,
        converted_slugs,
        converted_ids,
        reverse_non_slug_mappings=None,
        use_id=False,
    ) -> None:
        check_no_slugs_in_kwargs = endpoint_class not in self.no_slugs_in_kwargs_allowlist
        if check_no_slugs_in_kwargs:
            assert not any(str.endswith(param, "_slug") for param in converted_ids)
            assert converted_slugs == converted_ids
        else:
            # Only compare kwargs which are *_slug
            assert all(
                converted_slugs[key] == converted_ids[key]
                for key in converted_slugs
                if not key.endswith("_slug")
            )

        # print(converted_slugs, converted_ids, reverse_non_slug_mappings)

        if use_id:
            self.assert_ids(
                converted_slugs, converted_ids, check_no_slugs_in_kwargs, reverse_non_slug_mappings
            )
        else:
            self.assert_objects(
                converted_slugs, converted_ids, check_no_slugs_in_kwargs, reverse_non_slug_mappings
            )
