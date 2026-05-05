from unittest.mock import patch

from django.core.cache import cache

from sentry.issues.services.issue_label.cache import IssueLabelCache, OrganizationLabelCache
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options


class IssueLabelCacheTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group_id = 12345
        cache.clear()

    def tearDown(self) -> None:
        cache.clear()
        super().tearDown()

    def test_make_key(self) -> None:
        key = IssueLabelCache._make_key(self.group_id)
        assert key == f"issuelabel:g:{self.group_id}"

    def test_get_returns_none_on_cache_miss(self) -> None:
        assert IssueLabelCache.get(self.group_id) is None

    def test_set_and_get(self) -> None:
        values = [{"label": "bug", "value": "critical"}]
        IssueLabelCache.set(self.group_id, values)
        assert IssueLabelCache.get(self.group_id) == values

    def test_set_empty_list(self) -> None:
        IssueLabelCache.set(self.group_id, [])
        assert IssueLabelCache.get(self.group_id) == []

    def test_invalidate_removes_cached_entry(self) -> None:
        values = [{"label": "bug"}]
        IssueLabelCache.set(self.group_id, values)
        assert IssueLabelCache.get(self.group_id) is not None

        IssueLabelCache.invalidate(self.group_id)
        assert IssueLabelCache.get(self.group_id) is None

    def test_invalidate_nonexistent_key_is_noop(self) -> None:
        IssueLabelCache.invalidate(self.group_id)
        assert IssueLabelCache.get(self.group_id) is None

    def test_separate_group_ids_are_isolated(self) -> None:
        other_group_id = 99999
        values_a = [{"label": "a"}]
        values_b = [{"label": "b"}]

        IssueLabelCache.set(self.group_id, values_a)
        IssueLabelCache.set(other_group_id, values_b)

        assert IssueLabelCache.get(self.group_id) == values_a
        assert IssueLabelCache.get(other_group_id) == values_b

    def test_invalidate_does_not_affect_other_keys(self) -> None:
        other_group_id = 99999
        IssueLabelCache.set(self.group_id, [{"label": "a"}])
        IssueLabelCache.set(other_group_id, [{"label": "b"}])

        IssueLabelCache.invalidate(self.group_id)

        assert IssueLabelCache.get(self.group_id) is None
        assert IssueLabelCache.get(other_group_id) == [{"label": "b"}]

    def test_set_uses_option_ttl(self) -> None:
        with override_options({"issues.issue-label-cache-ttl": 120}):
            with patch("sentry.issues.services.issue_label.cache.cache.set") as mock_cache_set:
                IssueLabelCache.set(self.group_id, [])
                mock_cache_set.assert_called_once_with(
                    IssueLabelCache._make_key(self.group_id), [], 120
                )

    def test_set_uses_default_ttl(self) -> None:
        with patch("sentry.issues.services.issue_label.cache.cache.set") as mock_cache_set:
            IssueLabelCache.set(self.group_id, [])
            mock_cache_set.assert_called_once_with(
                IssueLabelCache._make_key(self.group_id), [], 600
            )


class OrganizationLabelCacheTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org_id = 54321
        cache.clear()

    def tearDown(self) -> None:
        cache.clear()
        super().tearDown()

    def test_make_key(self) -> None:
        key = OrganizationLabelCache._make_key(self.org_id)
        assert key == f"orglabel:o:{self.org_id}"

    def test_get_returns_none_on_cache_miss(self) -> None:
        assert OrganizationLabelCache.get(self.org_id) is None

    def test_set_and_get(self) -> None:
        values = [{"label_name": "priority"}]
        OrganizationLabelCache.set(self.org_id, values)
        assert OrganizationLabelCache.get(self.org_id) == values

    def test_set_empty_list(self) -> None:
        OrganizationLabelCache.set(self.org_id, [])
        assert OrganizationLabelCache.get(self.org_id) == []

    def test_invalidate_removes_cached_entry(self) -> None:
        OrganizationLabelCache.set(self.org_id, [{"label_name": "env"}])
        assert OrganizationLabelCache.get(self.org_id) is not None

        OrganizationLabelCache.invalidate(self.org_id)
        assert OrganizationLabelCache.get(self.org_id) is None

    def test_invalidate_nonexistent_key_is_noop(self) -> None:
        OrganizationLabelCache.invalidate(self.org_id)
        assert OrganizationLabelCache.get(self.org_id) is None

    def test_separate_org_ids_are_isolated(self) -> None:
        other_org_id = 99999
        values_a = [{"label_name": "a"}]
        values_b = [{"label_name": "b"}]

        OrganizationLabelCache.set(self.org_id, values_a)
        OrganizationLabelCache.set(other_org_id, values_b)

        assert OrganizationLabelCache.get(self.org_id) == values_a
        assert OrganizationLabelCache.get(other_org_id) == values_b

    def test_invalidate_does_not_affect_other_keys(self) -> None:
        other_org_id = 99999
        OrganizationLabelCache.set(self.org_id, [{"label_name": "a"}])
        OrganizationLabelCache.set(other_org_id, [{"label_name": "b"}])

        OrganizationLabelCache.invalidate(self.org_id)

        assert OrganizationLabelCache.get(self.org_id) is None
        assert OrganizationLabelCache.get(other_org_id) == [{"label_name": "b"}]

    def test_set_uses_option_ttl(self) -> None:
        with override_options({"issues.org-label-cache-ttl": 300}):
            with patch("sentry.issues.services.issue_label.cache.cache.set") as mock_cache_set:
                OrganizationLabelCache.set(self.org_id, [])
                mock_cache_set.assert_called_once_with(
                    OrganizationLabelCache._make_key(self.org_id), [], 300
                )

    def test_set_uses_default_ttl(self) -> None:
        with patch("sentry.issues.services.issue_label.cache.cache.set") as mock_cache_set:
            OrganizationLabelCache.set(self.org_id, [])
            mock_cache_set.assert_any_call(OrganizationLabelCache._make_key(self.org_id), [], 600)
