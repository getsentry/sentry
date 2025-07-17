from unittest.mock import patch

from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.options import override_options


class ProjectOptionManagerTest(TransactionTestCase):
    def test_set_value(self):
        ProjectOption.objects.set_value(self.project, "foo", "bar")
        assert ProjectOption.objects.get(project=self.project, key="foo").value == "bar"

    def test_get_value(self):
        result = ProjectOption.objects.get_value(self.project, "foo")
        assert result is None

        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        result = ProjectOption.objects.get_value(self.project, "foo")
        assert result == "bar"

    def test_unset_value(self):
        ProjectOption.objects.unset_value(self.project, "foo")
        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        ProjectOption.objects.unset_value(self.project, "foo")
        assert not ProjectOption.objects.filter(project=self.project, key="foo").exists()

    def test_get_value_bulk(self):
        result = ProjectOption.objects.get_value_bulk([self.project], "foo")
        assert result == {self.project: None}

        ProjectOption.objects.create(project=self.project, key="foo", value="bar")
        result = ProjectOption.objects.get_value_bulk([self.project], "foo")
        assert result == {self.project: "bar"}

    def test_set_value_with_new_caching_option_enabled(self):
        """Test set_value behavior with reload_cache_only_on_value_change enabled"""
        with override_options({"sentry.project_option.reload_cache_only_on_value_change": True}):
            with patch.object(ProjectOption.objects, "reload_cache") as mock_reload:
                # Test creating new option - should reload cache
                result = ProjectOption.objects.set_value(self.project, "new_key", "new_value")
                assert result is True  # Value changed (created)
                assert mock_reload.called
                mock_reload.reset_mock()

                # Test setting same value - should NOT reload cache
                result2 = ProjectOption.objects.set_value(self.project, "new_key", "new_value")
                assert result2 is False  # Value did not change
                assert not mock_reload.called

                # Test setting different value - should reload cache
                result3 = ProjectOption.objects.set_value(  # type: ignore[unreachable]
                    self.project, "new_key", "updated_value"
                )
                assert result3 is True  # Value changed
                assert mock_reload.called
                mock_reload.reset_mock()

                # Test setting value with reload_cache=False - should not reload cache even if value changes
                result4 = ProjectOption.objects.set_value(
                    self.project, "new_key", "another_value", reload_cache=False
                )
                assert result4 is True  # Value changed
                assert not mock_reload.called

    def test_set_value_with_new_caching_option_disabled(self):
        """Test set_value behavior with reload_cache_only_on_value_change disabled (legacy behavior)"""
        with override_options({"sentry.project_option.reload_cache_only_on_value_change": False}):
            with patch.object(ProjectOption.objects, "reload_cache") as mock_reload:
                # Test creating new option - should reload cache
                result = ProjectOption.objects.set_value(self.project, "new_key", "new_value")
                assert result is True  # Created
                assert mock_reload.called
                mock_reload.reset_mock()

                # Test setting same value - should STILL return True and reload cache (legacy behavior)
                # This is because create_or_update always returns (1, False) for existing records
                result = ProjectOption.objects.set_value(self.project, "new_key", "new_value")
                assert (
                    result is True
                )  # Legacy: always True for existing records (created=False, inst=1 > 0)
                assert mock_reload.called  # Should always reload in legacy mode
                mock_reload.reset_mock()

                # Test setting different value - should reload cache
                result = ProjectOption.objects.set_value(self.project, "new_key", "updated_value")
                assert result is True  # Updated
                assert mock_reload.called
                mock_reload.reset_mock()

                # Test setting value with reload_cache=False - should not reload cache
                result = ProjectOption.objects.set_value(
                    self.project, "new_key", "another_value", reload_cache=False
                )
                assert result is True  # Updated
                assert not mock_reload.called

    def test_set_value_with_project_id(self):
        """Test set_value works with project ID instead of project object"""
        with override_options({"sentry.project_option.reload_cache_only_on_value_change": True}):
            result = ProjectOption.objects.set_value(self.project.id, "id_key", "id_value")
            assert result is True  # Created
            assert ProjectOption.objects.get(project=self.project, key="id_key").value == "id_value"

            # Test setting same value with project ID
            result = ProjectOption.objects.set_value(self.project.id, "id_key", "id_value")
            assert result is False  # No change

            # Test setting different value with project ID
            result = ProjectOption.objects.set_value(self.project.id, "id_key", "new_id_value")
            assert result is True  # Changed
            assert (
                ProjectOption.objects.get(project=self.project, key="id_key").value
                == "new_id_value"
            )
