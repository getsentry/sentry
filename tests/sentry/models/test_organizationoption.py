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

    def test_reload_task_local_cache_takes_values_saved_by_another_process(self) -> None:
        OrganizationOption.objects.set_value(self.organization, "foo", "bar")
        cache_key = OrganizationOption.objects._make_key(self.organization.id)
        stale = OrganizationOption.objects._option_cache[cache_key]

        # Another process saves a new value. The database and the shared cache
        # have it, but this process still holds the old value.
        OrganizationOption.objects.set_value(self.organization, "foo", "baz")
        OrganizationOption.objects._option_cache[cache_key] = stale
        assert OrganizationOption.objects.get_value(self.organization, "foo") == "bar"

        OrganizationOption.objects.reload_task_local_cache(self.organization.id)

        assert OrganizationOption.objects.get_value(self.organization, "foo") == "baz"

    def test_reload_task_local_cache_without_shared_cache_reads_the_database(self) -> None:
        OrganizationOption.objects.set_value(self.organization, "foo", "bar")
        cache_key = OrganizationOption.objects._make_key(self.organization.id)
        stale = OrganizationOption.objects._option_cache[cache_key]

        OrganizationOption.objects.set_value(self.organization, "foo", "baz")
        OrganizationOption.objects._option_cache[cache_key] = stale
        cache.delete(cache_key)

        OrganizationOption.objects.reload_task_local_cache(self.organization.id)

        assert OrganizationOption.objects.get_value(self.organization, "foo") == "baz"
