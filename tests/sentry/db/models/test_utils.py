from sentry.db.models.utils import slugify_instance
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase


class SlugifyInstanceTest(TestCase):
    def test_no_conflict(self):
        org = Organization(name="matt")
        slugify_instance(org, org.name)
        assert org.slug == "matt"

    def test_conflict(self):
        base_slug = self.organization.slug
        org = Organization(name="foo")
        slugify_instance(org, base_slug)
        assert org.slug.startswith(base_slug + "-")

    def test_reserved(self):
        base_slug = self.organization.slug
        org = Organization(name="foo")
        slugify_instance(org, base_slug, reserved=(base_slug,))
        assert not org.slug.startswith(base_slug + "-")

    def test_max_length(self):
        org = Organization(name="matt")
        slugify_instance(org, org.name, max_length=2)
        assert org.slug == "ma"

    def test_appends_to_entirely_numeric(self):
        org = Organization(name="1234")
        slugify_instance(org, org.name)
        assert org.slug.startswith("1234" + "-")

    def test_replaces_space_with_hyphen(self):
        org = Organization(name="f o o")
        slugify_instance(org, org.name)
        assert org.slug == "f-o-o"

    def test_removes_underscores(self):
        org = Organization(name="_foo_")
        slugify_instance(org, org.name)
        assert org.slug == "foo"
