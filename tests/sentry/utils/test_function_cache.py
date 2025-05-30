from unittest.mock import create_autospec

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import region_silo_model
from sentry.testutils.cases import TestCase
from sentry.utils.function_cache import (
    batch_cache_func_for_models,
    cache_func,
    cache_func_for_models,
)

cache_func_for_models


@region_silo_model
class CacheModel(models.Model):
    __relocation_scope__ = RelocationScope.Excluded
    some_field = models.TextField()

    class Meta:
        app_label = "fixtures"


def count_func(text_search: str):
    return CacheModel.objects.filter(some_field=text_search).count()


def simple_func(val: str):
    return val + "_yay"


def arg_extractor(instance: CacheModel):
    return (instance.some_field,)


class CacheFuncForModelsTest(TestCase):
    def assert_called_with_count(self, mock_test_func, text_search: str, count: int):
        assert (
            len([ca for ca in mock_test_func.call_args_list if ca.args[0] == text_search]) == count
        )

    def test(self):
        mock_test_func = create_autospec(count_func)
        mock_test_func.side_effect = count_func
        decorated_test_func = cache_func_for_models([(CacheModel, arg_extractor)])(mock_test_func)
        self.assert_called_with_count(mock_test_func, "test", 0)
        assert decorated_test_func("test") == 0
        self.assert_called_with_count(mock_test_func, "test", 1)
        assert decorated_test_func("test") == 0
        self.assert_called_with_count(mock_test_func, "test", 1)

        CacheModel.objects.create(some_field="test")
        # Since we're actively refetching the count should go to 2 here
        self.assert_called_with_count(mock_test_func, "test", 2)
        assert decorated_test_func("test") == 1
        self.assert_called_with_count(mock_test_func, "test", 2)
        CacheModel.objects.create(some_field="test")
        self.assert_called_with_count(mock_test_func, "test", 3)
        assert decorated_test_func("test") == 2
        self.assert_called_with_count(mock_test_func, "test", 3)
        CacheModel.objects.create(some_field="another_val")
        self.assert_called_with_count(mock_test_func, "test", 3)
        assert decorated_test_func("test") == 2

    def test_no_recalculate(self):
        mock_test_func = create_autospec(count_func)
        mock_test_func.side_effect = count_func
        decorated_test_func = cache_func_for_models(
            [(CacheModel, arg_extractor)], recalculate=False
        )(mock_test_func)
        self.assert_called_with_count(mock_test_func, "test", 0)
        assert decorated_test_func("test") == 0
        self.assert_called_with_count(mock_test_func, "test", 1)

        CacheModel.objects.create(some_field="test")
        # Since we're not actively refetching the count should remain the same here
        self.assert_called_with_count(mock_test_func, "test", 1)
        assert decorated_test_func("test") == 1
        self.assert_called_with_count(mock_test_func, "test", 2)
        CacheModel.objects.create(some_field="test")
        self.assert_called_with_count(mock_test_func, "test", 2)
        assert decorated_test_func("test") == 2
        self.assert_called_with_count(mock_test_func, "test", 3)
        CacheModel.objects.create(some_field="another_val")
        self.assert_called_with_count(mock_test_func, "test", 3)
        assert decorated_test_func("test") == 2


class CacheFuncTest(TestCase):
    def assert_called_with_count(self, mock_test_func, text_search: str, count: int):
        assert (
            len([ca for ca in mock_test_func.call_args_list if ca.args[0] == text_search]) == count
        )

    def test(self):
        mock_test_func = create_autospec(simple_func)
        mock_test_func.side_effect = simple_func
        decorated_test_func = cache_func()(mock_test_func)
        self.assert_called_with_count(mock_test_func, "test", 0)
        assert decorated_test_func("test") == "test_yay"
        self.assert_called_with_count(mock_test_func, "test", 1)
        assert decorated_test_func("test") == "test_yay"
        self.assert_called_with_count(mock_test_func, "test", 1)

        self.assert_called_with_count(mock_test_func, "test_2", 0)
        assert decorated_test_func("test_2") == "test_2_yay"
        self.assert_called_with_count(mock_test_func, "test_2", 1)
        assert decorated_test_func("test_2") == "test_2_yay"
        self.assert_called_with_count(mock_test_func, "test_2", 1)


class BatchCacheFuncForModelsTest(TestCase):
    def assert_called_with_count(self, mock_test_func, keys: list[str], count: int):
        assert len([ca for ca in mock_test_func.call_args_list if ca.args[0] == keys]) == count

    def test(self) -> None:
        def batch_count_func(text_searches: list[str]) -> list[int]:
            return [
                CacheModel.objects.filter(some_field=search).count() for search in text_searches
            ]

        # Non-batch arg extractor must return a tuple.
        def batch_arg_extractor(instance: CacheModel) -> str:
            return instance.some_field

        mock_test_func = create_autospec(batch_count_func)
        mock_test_func.side_effect = batch_count_func
        decorated_test_func = batch_cache_func_for_models([(CacheModel, batch_arg_extractor)])(
            mock_test_func
        )

        # First call should hit the function
        self.assert_called_with_count(mock_test_func, ["test"], 0)
        assert decorated_test_func(["test"]) == [0]
        self.assert_called_with_count(mock_test_func, ["test"], 1)

        # Second call should use cache
        assert decorated_test_func(["test"]) == [0]
        self.assert_called_with_count(mock_test_func, ["test"], 1)

        # Create a model, should invalidate cache
        CacheModel.objects.create(some_field="test")
        assert decorated_test_func(["test"]) == [1]
        self.assert_called_with_count(mock_test_func, ["test"], 2)

        # Test multiple keys
        assert decorated_test_func(["test", "other"]) == [1, 0]
        self.assert_called_with_count(mock_test_func, ["other"], 1)

        # Create another model, should only invalidate "test" cache
        CacheModel.objects.create(some_field="test")
        assert decorated_test_func(["test", "other"]) == [2, 0]
        self.assert_called_with_count(mock_test_func, ["test"], 3)
        self.assert_called_with_count(mock_test_func, ["other"], 1)

    def test_no_recalculate(self):
        def batch_count_func(text_searches: list[str]) -> list[int]:
            return [
                CacheModel.objects.filter(some_field=search).count() for search in text_searches
            ]

        # Non-batch arg extractor must return a tuple.
        def batch_arg_extractor(instance: CacheModel):
            return instance.some_field

        mock_test_func = create_autospec(batch_count_func)
        mock_test_func.side_effect = batch_count_func
        decorated_test_func = batch_cache_func_for_models(
            [(CacheModel, batch_arg_extractor)], recalculate=False
        )(mock_test_func)

        # First call should hit the function
        self.assert_called_with_count(mock_test_func, ["test"], 0)
        assert decorated_test_func(["test"]) == [0]
        self.assert_called_with_count(mock_test_func, ["test"], 1)

        # Create a model, should invalidate cache but not recalculate
        CacheModel.objects.create(some_field="test")
        self.assert_called_with_count(mock_test_func, ["test"], 1)

        # Second call should hit function again since we didn't recalculate
        assert decorated_test_func(["test"]) == [1]
        self.assert_called_with_count(mock_test_func, ["test"], 2)
