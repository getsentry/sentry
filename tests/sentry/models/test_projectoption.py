from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.utils.cache import cache


class ProjectOptionManagerTest(TestCase):
    def test_set_value(self) -> None:
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        assert ProjectOption.objects.get(project=self.project, key="foo").value == "bar"

    def test_get_value(self) -> None:
        result = ProjectOption.objects.get_value(self.project, "foo")
        assert result is None

        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        result = ProjectOption.objects.get_value(self.project, "foo")
        assert result == "bar"

    def test_unset_value(self) -> None:
        ProjectOption.objects.unset_value(self.project, "foo")
        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        ProjectOption.objects.unset_value(self.project, "foo")
        assert not ProjectOption.objects.filter(project=self.project, key="foo").exists()

    def test_get_value_bulk(self) -> None:
        result = ProjectOption.objects.get_value_bulk([self.project], "foo")
        assert result == {self.project: None}

        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        result = ProjectOption.objects.get_value_bulk([self.project], "foo")
        assert result == {self.project: "bar"}

    def test_reload_task_local_cache_takes_values_saved_by_another_process(self) -> None:
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        cache_key = ProjectOption.objects._make_key(self.project.id)
        stale = ProjectOption.objects._option_cache[cache_key]

        # Another process saves a new value. The database and the shared cache
        # have it, but this process still holds the old value.
        ProjectOption.objects.set_value(self.project, "foo", "baz")
        ProjectOption.objects._option_cache[cache_key] = stale
        assert ProjectOption.objects.get_value(self.project, "foo") == "bar"

        ProjectOption.objects.reload_task_local_cache(self.project.id)

        assert ProjectOption.objects.get_value(self.project, "foo") == "baz"

    def test_reload_task_local_cache_without_shared_cache_reads_the_database(self) -> None:
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        cache_key = ProjectOption.objects._make_key(self.project.id)
        stale = ProjectOption.objects._option_cache[cache_key]

        ProjectOption.objects.set_value(self.project, "foo", "baz")
        ProjectOption.objects._option_cache[cache_key] = stale
        cache.delete(cache_key)

        ProjectOption.objects.reload_task_local_cache(self.project.id)

        assert ProjectOption.objects.get_value(self.project, "foo") == "baz"
