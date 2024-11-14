import pytest

from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.utils.email import ListResolver
from sentry.utils.email.message_builder import default_list_type_handlers


class ListResolverTestCase(TestCase):
    resolver = ListResolver("namespace", default_list_type_handlers)

    def test_rejects_invalid_namespace(self):
        with pytest.raises(AssertionError):
            ListResolver("\x00", {})

    def test_rejects_invalid_types(self):
        with pytest.raises(ListResolver.UnregisteredTypeError):
            self.resolver(self.user)

    def test_generates_list_ids(self):
        expected = f"<{self.event.project.slug}.{self.event.organization.slug}.namespace>"
        assert self.resolver(self.event.group) == expected
        assert self.resolver(self.event.project) == expected

    def test_rejects_invalid_objects(self):
        resolver = ListResolver("namespace", {Project: lambda value: ("\x00",)})

        with pytest.raises(AssertionError):
            resolver(self.project)
