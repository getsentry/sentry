from __future__ import annotations

import pytest
from rest_framework.exceptions import ParseError

from sentry.models.organizationmapping import OrganizationMapping
from sentry.synapse.paginator import Cursor, SynapsePaginator
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class CursorTest(TestCase):
    def test_encode_decode(self) -> None:
        original = Cursor(updated_at=1234567890, id=42)
        assert Cursor.decode(original.encode()) == original

    def test_decode_invalid_cursor_raises(self) -> None:
        with pytest.raises(ParseError):
            Cursor.decode("!!!not-base64!!!")


@control_silo_test
class SynapsePaginatorTest(TestCase):
    def test_paginates(self) -> None:
        orgs = [self.create_organization() for _ in range(5)]
        paginator = SynapsePaginator(
            queryset=OrganizationMapping.objects.all(),
            id_field="organization_id",
            timestamp_field="date_updated",
        )

        cursor = None

        expected = [
            # org ids, expected has_more
            ([orgs[0].id, orgs[1].id], True),
            ([orgs[2].id, orgs[3].id], True),
            ([orgs[4].id], False),
        ]

        for ids, expected_more in expected:
            page = paginator.get_result(limit=2, cursor_str=cursor)
            assert page.has_more is expected_more
            assert set(ids) == {r.organization_id for r in page.results}
            cursor = page.next_cursor
