from __future__ import absolute_import

from sentry.testutils import TestCase
from sentry.db.models.utils import slugify_instance
from sentry.models import Organization


class SlugifyInstanceTest(TestCase):
    def test_no_conflict(self):
        org = Organization(name="matt")
        slugify_instance(org, "matt")
        assert org.slug == "matt"
        assert not Organization.objects.filter(slug="matt").exists()

    def test_conflict(self):
        base_slug = self.organization.slug
        org = Organization(name="foo")
        slugify_instance(org, base_slug)
        assert org.slug.startswith(base_slug + "-"), org.slug
        assert not Organization.objects.filter(slug=org.slug).exists()

    def test_reserved(self):
        base_slug = self.organization.slug
        org = Organization(name="foo")
        slugify_instance(org, base_slug, reserved=(base_slug,))
        assert not org.slug.startswith(base_slug + "-"), org.slug
        assert not Organization.objects.filter(slug=org.slug).exists()

    def test_max_length(self):
        org = Organization(name="matt")
        slugify_instance(org, "matt", max_length=2)
        assert org.slug == "ma", org.slug
        assert not Organization.objects.filter(slug="ma").exists()
