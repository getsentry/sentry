import pytest
from django.db import IntegrityError, router, transaction

from sentry.explore.models import (
    TraceItemAttributeContext,
    TraceItemAttributeTypes,
    TraceItemTypes,
)
from sentry.search.eap.types import SupportedTraceItemType
from sentry.testutils.cases import TestCase


def test_trace_item_types_in_sync_with_supported_trace_item_type() -> None:
    # TraceItemTypes stores integers but must stay convertible to/from the
    # SupportedTraceItemType string enum. If a new item type is added to the enum,
    # add a corresponding member here (with a new, never-reused integer id).
    assert set(TraceItemTypes.TYPE_NAMES) == {t.value for t in SupportedTraceItemType}


class TraceItemAttributeContextTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def test_create_project_scoped(self) -> None:
        description = TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=self.project,
            attribute_key="http.method",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.STRING,
            brief="The HTTP method of the request",
            examples=["GET", "POST"],
            created_by_id=self.user.id,
        )
        assert description.id is not None
        assert description.examples == ["GET", "POST"]
        assert description.additional_context is None
        assert description.last_received is None

    def test_create_org_wide(self) -> None:
        description = TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=None,
            attribute_key="http.method",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.STRING,
        )
        assert description.project_id is None
        assert description.examples == []

    def test_unique_project_scoped(self) -> None:
        TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=self.project,
            attribute_key="http.method",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.STRING,
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(TraceItemAttributeContext)),
        ):
            TraceItemAttributeContext.objects.create(
                organization=self.org,
                project=self.project,
                attribute_key="http.method",
                item_type=TraceItemTypes.SPANS,
                attribute_type=TraceItemAttributeTypes.STRING,
            )

    def test_unique_org_wide(self) -> None:
        TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=None,
            attribute_key="http.method",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.STRING,
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(TraceItemAttributeContext)),
        ):
            TraceItemAttributeContext.objects.create(
                organization=self.org,
                project=None,
                attribute_key="http.method",
                item_type=TraceItemTypes.SPANS,
                attribute_type=TraceItemAttributeTypes.STRING,
            )

    def test_differing_attribute_type_is_allowed(self) -> None:
        TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=self.project,
            attribute_key="duration",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.STRING,
        )
        # Same key but a different value type is a distinct attribute.
        TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=self.project,
            attribute_key="duration",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.NUMBER,
        )
        assert TraceItemAttributeContext.objects.count() == 2

    def test_project_and_org_wide_coexist(self) -> None:
        # An org-wide description and a project-scoped description for the same
        # attribute are not in conflict.
        TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=None,
            attribute_key="http.method",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.STRING,
        )
        TraceItemAttributeContext.objects.create(
            organization=self.org,
            project=self.project,
            attribute_key="http.method",
            item_type=TraceItemTypes.SPANS,
            attribute_type=TraceItemAttributeTypes.STRING,
        )
        assert TraceItemAttributeContext.objects.count() == 2
