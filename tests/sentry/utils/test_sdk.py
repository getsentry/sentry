from sentry_sdk import Scope

from sentry.testutils import TestCase
from sentry.utils.sdk import merge_context_into_scope


class SDKUtilsTest(TestCase):
    def test_context_scope_merge_no_existing_context(self):
        scope = Scope()
        new_context_data = {"maisey": "silly", "charlie": "goofy"}

        assert "dogs" not in scope._contexts

        merge_context_into_scope("dogs", new_context_data, scope)

        assert "dogs" in scope._contexts
        assert scope._contexts["dogs"] == new_context_data

    def test_context_scope_merge_with_existing_context(self):
        scope = Scope()
        existing_context_data = {"cory": "nudgy", "bodhi": "floppy"}
        new_context_data = {"maisey": "silly", "charlie": "goofy"}
        scope.set_context("dogs", existing_context_data)

        assert "dogs" in scope._contexts

        merge_context_into_scope("dogs", new_context_data, scope)

        assert scope._contexts["dogs"] == {
            "cory": "nudgy",
            "bodhi": "floppy",
            "maisey": "silly",
            "charlie": "goofy",
        }
