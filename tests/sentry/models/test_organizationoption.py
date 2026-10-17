from sentry.models.options.organization_option import OrganizationOption
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class OrganizationOptionManagerTest(TestCase):
    def test_set_value(self) -> None:
        OrganizationOption.objects.set_value(self.organization, "foo", "bar")
        assert (
            OrganizationOption.objects.get(organization=self.organization, key="foo").value == "bar"
        )

    def test_get_value(self) -> None:
        result = OrganizationOption.objects.get_value(self.organization, "foo")
        assert result is None

        OrganizationOption.objects.create(organization=self.organization, key="foo", value="bar")
        result = OrganizationOption.objects.get_value(self.organization, "foo")
        assert result == "bar"

    def test_unset_value(self) -> None:
        OrganizationOption.objects.unset_value(self.organization, "foo")
        OrganizationOption.objects.create(organization=self.organization, key="foo", value="bar")
        OrganizationOption.objects.unset_value(self.organization, "foo")
        assert not OrganizationOption.objects.filter(
            organization=self.organization, key="foo"
        ).exists()

    def test_get_value_bulk(self) -> None:
        result = OrganizationOption.objects.get_value_bulk([self.organization], "foo")
        assert result == {self.organization: None}

        OrganizationOption.objects.create(organization=self.organization, key="foo", value="bar")
        result = OrganizationOption.objects.get_value_bulk([self.organization], "foo")
        assert result == {self.organization: "bar"}

    def test_reload_task_local_cache_uses_shared_cache(self) -> None:
        OrganizationOption.objects.set_value(self.organization, "foo", "bar")
        # Another process saved a new value: the shared cache has it, but this
        # process still holds the old value in its local cache.
        cache.set(OrganizationOption.objects._make_key(self.organization.id), {"foo": "baz"})
        assert OrganizationOption.objects.get_value(self.organization, "foo") == "bar"

        OrganizationOption.objects.reload_task_local_cache(self.organization.id)

        assert OrganizationOption.objects.get_value(self.organization, "foo") == "baz"

    def test_reload_task_local_cache_refetches_without_shared_cache(self) -> None:
        OrganizationOption.objects.set_value(self.organization, "foo", "bar")
        # Queryset updates skip the save signals, so neither cache is refreshed.
        OrganizationOption.objects.filter(organization=self.organization, key="foo").update(
            value="baz"
        )
        cache.delete(OrganizationOption.objects._make_key(self.organization.id))
        assert OrganizationOption.objects.get_value(self.organization, "foo") == "bar"

        OrganizationOption.objects.reload_task_local_cache(self.organization.id)

        assert OrganizationOption.objects.get_value(self.organization, "foo") == "baz"
