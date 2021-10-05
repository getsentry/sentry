import pytest

from sentry.testutils import TestCase
from sentry.utils.email import ListResolver
from sentry.utils.email.message_builder import default_list_type_handlers


class ListResolverTestCase(TestCase):
    resolver = ListResolver("namespace", default_list_type_handlers)

    def test_rejects_invalid_namespace(self):
        with pytest.raises(AssertionError):
            ListResolver("\x00", {})

    def test_rejects_invalid_types(self):
        with pytest.raises(ListResolver.UnregisteredTypeError):
            self.resolver(object())

    def test_generates_list_ids(self):
        expected = "<{0.project.slug}.{0.organization.slug}.namespace>".format(self.event)
        assert self.resolver(self.event.group) == expected
        assert self.resolver(self.event.project) == expected

    def test_rejects_invalid_objects(self):
        resolver = ListResolver("namespace", {object: lambda value: ("\x00",)})

        with pytest.raises(AssertionError):
            resolver(object())
