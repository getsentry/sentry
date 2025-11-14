from typing import int
from sentry.db.models.utils import is_model_attr_cached, slugify_instance
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Detector


class TestIsModelAttrCached(TestCase):
    def test_works_with_standard_attrs(self) -> None:
        org = self.create_organization()
        assert is_model_attr_cached(org, "name") is True

    def test_creation_association(self) -> None:
        detector = self.create_detector()
        assert is_model_attr_cached(detector, "workflow_condition_group") is False

        detector.workflow_condition_group = self.create_data_condition_group()
        detector.save()
        refetched_detector = Detector.objects.get(id=detector.id)

        # Detector maintains the association in memory
        assert is_model_attr_cached(detector, "workflow_condition_group") is True

        # When refetched, the association is not cached
        assert is_model_attr_cached(refetched_detector, "workflow_condition_group") is False

    def test_select_related(self) -> None:
        detector = self.create_detector()
        detector.workflow_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            condition_result=75,
        )

        detector.save()

        refetched_detector = (
            Detector.objects.filter(id=detector.id)
            .select_related("workflow_condition_group")
            .first()
        )

        assert refetched_detector is not None
        assert is_model_attr_cached(refetched_detector, "workflow_condition_group") is True

    def test_prefetch(self) -> None:
        detector = self.create_detector()
        detector.workflow_condition_group = self.create_data_condition_group()
        self.create_data_condition(
            condition_group=detector.workflow_condition_group,
            condition_result=75,
        )

        detector.save()

        refetched_detector = (
            Detector.objects.filter(id=detector.id)
            .select_related("workflow_condition_group")
            .prefetch_related("workflow_condition_group__conditions")
            .first()
        )

        assert refetched_detector is not None
        assert refetched_detector.workflow_condition_group is not None
        assert is_model_attr_cached(refetched_detector, "workflow_condition_group") is True
        assert (
            is_model_attr_cached(refetched_detector.workflow_condition_group, "conditions") is True
        )

        # use the same model, but different query to ensure cache check is correct
        another = Detector.objects.get(id=detector.id)
        assert is_model_attr_cached(another, "workflow_condition_group") is False


class SlugifyInstanceTest(TestCase):
    def test_no_conflict(self) -> None:
        org = Organization(name="matt")
        slugify_instance(org, org.name)
        assert org.slug == "matt"

    def test_conflict(self) -> None:
        base_slug = self.organization.slug
        org = Organization(name="foo")
        slugify_instance(org, base_slug)
        assert org.slug.startswith(base_slug + "-")

    def test_reserved(self) -> None:
        base_slug = self.organization.slug
        org = Organization(name="foo")
        slugify_instance(org, base_slug, reserved=(base_slug,))
        assert not org.slug.startswith(base_slug + "-")

    def test_max_length(self) -> None:
        org = Organization(name="matt")
        slugify_instance(org, org.name, max_length=2)
        assert org.slug == "ma"

    def test_appends_to_entirely_numeric(self) -> None:
        org = Organization(name="1234")
        slugify_instance(org, org.name)
        assert org.slug.startswith("1234" + "-")

    def test_replaces_space_with_hyphen(self) -> None:
        org = Organization(name="f o o")
        slugify_instance(org, org.name)
        assert org.slug == "f-o-o"

    def test_removes_underscores(self) -> None:
        org = Organization(name="_foo_")
        slugify_instance(org, org.name)
        assert org.slug == "foo"
