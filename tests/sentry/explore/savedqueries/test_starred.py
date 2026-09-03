import pytest

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryStarred
from sentry.explore.models import ExploreSavedQuery, ExploreSavedQueryStarred
from sentry.explore.savedqueries import starred
from sentry.explore.savedqueries.types import SavedQueryRef, SavedQueryType
from sentry.models.organization import Organization
from sentry.testutils.cases import TestCase


class StarredHelpersTestBase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.other_user = self.create_user()
        self.create_member(organization=self.org, user=self.other_user)

    def discover_star(
        self,
        position: int | None,
        *,
        starred: bool = True,
        user_id: int | None = None,
        organization: Organization | None = None,
    ) -> DiscoverSavedQueryStarred:
        organization = organization or self.org
        query = DiscoverSavedQuery.objects.create(
            organization=organization, name=f"discover {position}", query={}
        )
        return DiscoverSavedQueryStarred.objects.create(
            organization=organization,
            user_id=user_id or self.user.id,
            discover_saved_query=query,
            position=position,
            starred=starred,
        )

    def explore_star(
        self,
        position: int | None,
        *,
        starred: bool = True,
        user_id: int | None = None,
        organization: Organization | None = None,
    ) -> ExploreSavedQueryStarred:
        organization = organization or self.org
        query = ExploreSavedQuery.objects.create(
            organization=organization, name=f"explore {position}", query={}
        )
        return ExploreSavedQueryStarred.objects.create(
            organization=organization,
            user_id=user_id or self.user.id,
            explore_saved_query=query,
            position=position,
            starred=starred,
        )

    def ordered_refs(self, user_id: int | None = None) -> list[SavedQueryRef]:
        """
        Every positioned row the user has, across both tables, ordered by position.
        """
        user_id = user_id or self.user.id
        rows: list[tuple[int, SavedQueryRef]] = []
        for discover_row in DiscoverSavedQueryStarred.objects.filter(
            organization=self.org, user_id=user_id, position__isnull=False
        ):
            assert discover_row.position is not None
            rows.append(
                (
                    discover_row.position,
                    SavedQueryRef(SavedQueryType.DISCOVER, discover_row.discover_saved_query_id),
                )
            )
        for explore_row in ExploreSavedQueryStarred.objects.filter(
            organization=self.org, user_id=user_id, position__isnull=False
        ):
            assert explore_row.position is not None
            rows.append(
                (
                    explore_row.position,
                    SavedQueryRef(SavedQueryType.EXPLORE, explore_row.explore_saved_query_id),
                )
            )
        return [ref for _, ref in sorted(rows)]


class NextPositionTest(StarredHelpersTestBase):
    def test_no_starred_queries(self) -> None:
        assert starred.next_position(self.org, self.user.id) == 1

    def test_highest_position_in_discover(self) -> None:
        self.discover_star(4)
        self.explore_star(2)

        assert starred.next_position(self.org, self.user.id) == 5

    def test_highest_position_in_explore(self) -> None:
        self.discover_star(2)
        self.explore_star(4)

        assert starred.next_position(self.org, self.user.id) == 5

    def test_ignores_null_positions(self) -> None:
        self.discover_star(1)
        self.explore_star(None, starred=False)

        assert starred.next_position(self.org, self.user.id) == 2


class ShiftPositionsTest(StarredHelpersTestBase):
    def test_shift_in_both_tables(self) -> None:
        below = self.discover_star(1)
        at = self.explore_star(2)
        above = self.discover_star(3)

        starred.shift_positions(self.org, self.user.id, from_position=2, delta=1, inclusive=True)

        below.refresh_from_db()
        at.refresh_from_db()
        above.refresh_from_db()
        assert below.position == 1
        assert at.position == 3
        assert above.position == 4

    def test_negative_delta_closes_a_gap(self) -> None:
        below = self.discover_star(1)
        above = self.explore_star(3)

        starred.shift_positions(self.org, self.user.id, from_position=2, delta=-1)

        below.refresh_from_db()
        above.refresh_from_db()
        assert below.position == 1
        assert above.position == 2


class ReorderTest(StarredHelpersTestBase):
    def test_reuses_the_occupied_slots(self) -> None:
        # Reordering reuses slots, not necessarily contiguous
        discover = self.discover_star(2)
        explore = self.explore_star(5)

        discover_ref = SavedQueryRef(SavedQueryType.DISCOVER, discover.discover_saved_query_id)
        explore_ref = SavedQueryRef(SavedQueryType.EXPLORE, explore.explore_saved_query_id)

        starred.reorder(self.org, self.user.id, [explore_ref, discover_ref])

        explore.refresh_from_db()
        discover.refresh_from_db()
        assert explore.position == 2
        assert discover.position == 5

    def test_moves_a_query_from_the_end_to_the_front(self) -> None:
        first = self.explore_star(1)
        second = self.explore_star(2)
        third = self.discover_star(3)

        refs = [
            SavedQueryRef(SavedQueryType.DISCOVER, third.discover_saved_query_id),
            SavedQueryRef(SavedQueryType.EXPLORE, first.explore_saved_query_id),
            SavedQueryRef(SavedQueryType.EXPLORE, second.explore_saved_query_id),
        ]

        starred.reorder(self.org, self.user.id, refs)

        assert self.ordered_refs() == refs

    def test_rejects_duplicate_ref(self) -> None:
        discover = self.discover_star(1)
        self.explore_star(2)

        ref = SavedQueryRef(SavedQueryType.DISCOVER, discover.discover_saved_query_id)

        with pytest.raises(ValueError, match="multiple positions"):
            starred.reorder(self.org, self.user.id, [ref, ref])

    def test_rejects_missing_refs(self) -> None:
        # The failure mode this module exists to prevent: a caller that knows about one
        # product sends only its own queries, and the other product's positions are lost.
        self.discover_star(1)
        explore = self.explore_star(2)

        explore_ref = SavedQueryRef(SavedQueryType.EXPLORE, explore.explore_saved_query_id)

        with pytest.raises(ValueError, match="Mismatch between existing and provided"):
            starred.reorder(self.org, self.user.id, [explore_ref])
