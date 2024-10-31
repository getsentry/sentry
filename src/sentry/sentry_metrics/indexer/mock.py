import itertools
from collections import defaultdict
from collections.abc import Collection, Mapping
from typing import DefaultDict

from sentry.sentry_metrics.indexer.base import (
    FetchType,
    OrgId,
    StringIndexer,
    UseCaseKeyCollection,
    UseCaseKeyResult,
    UseCaseKeyResults,
    metric_path_key_compatible_resolve,
    metric_path_key_compatible_rev_resolve,
)
from sentry.sentry_metrics.indexer.strings import StaticStringIndexer
from sentry.sentry_metrics.use_case_id_registry import UseCaseID


class RawSimpleIndexer(StringIndexer):
    """Simple indexer with in-memory store. Do not use in production."""

    def __init__(self) -> None:
        self._counter = itertools.count(start=10000)
        self._strings: DefaultDict[UseCaseID, DefaultDict[OrgId, DefaultDict[str, int | None]]] = (
            defaultdict(lambda: defaultdict(lambda: defaultdict(self._counter.__next__)))
        )
        self._reverse: dict[int, str] = {}

    def bulk_record(
        self, strings: Mapping[UseCaseID, Mapping[OrgId, set[str]]]
    ) -> UseCaseKeyResults:
        db_read_keys = UseCaseKeyCollection(strings)
        db_read_key_results = UseCaseKeyResults()
        for use_case_id, org_strs in strings.items():
            for org_id, strs in org_strs.items():
                for string in strs:
                    id = self._strings[use_case_id][org_id].get(string)
                    if id is not None:
                        db_read_key_results.add_use_case_key_result(
                            UseCaseKeyResult(use_case_id, org_id=org_id, string=string, id=id),
                            fetch_type=FetchType.DB_READ,
                        )

        db_write_keys = db_read_key_results.get_unmapped_use_case_keys(db_read_keys)

        if db_write_keys.size == 0:
            return db_read_key_results

        db_write_key_results = UseCaseKeyResults()
        for use_case_id, org_id, string in db_write_keys.as_tuples():
            db_write_key_results.add_use_case_key_result(
                UseCaseKeyResult(
                    use_case_id=use_case_id,
                    org_id=org_id,
                    string=string,
                    id=self._record(use_case_id, org_id, string),
                ),
                fetch_type=FetchType.FIRST_SEEN,
            )

        return db_read_key_results.merge(db_write_key_results)

    def record(self, use_case_id: UseCaseID, org_id: int, string: str) -> int | None:
        return self._record(use_case_id, org_id, string)

    @metric_path_key_compatible_resolve
    def resolve(self, use_case_id: UseCaseID, org_id: int, string: str) -> int | None:
        strs = self._strings[use_case_id][org_id]
        return strs.get(string)

    @metric_path_key_compatible_rev_resolve
    def reverse_resolve(self, use_case_id: UseCaseID, org_id: int, id: int) -> str | None:
        return self._reverse.get(id)

    def bulk_reverse_resolve(
        self, use_case_id: UseCaseID, org_id: int, ids: Collection[int]
    ) -> Mapping[int, str]:
        # Performance is not an issue for this indexer, so we can fall back on reverse_resolve

        ret_val: dict[int, str] = {}
        for ident in ids:
            val = self.reverse_resolve(use_case_id, org_id, ident)
            if val is not None:
                ret_val[ident] = val
        return ret_val

    def _record(self, use_case_id: UseCaseID, org_id: OrgId, string: str) -> int | None:
        index = self._strings[use_case_id][org_id][string]
        if index is not None:
            self._reverse[index] = string
        return index

    def resolve_shared_org(self, string: str) -> int | None:
        raise NotImplementedError(
            "This class should not be used directly, use the wrapping class SimpleIndexer"
        )

    def reverse_shared_org_resolve(self, id: int) -> str | None:
        raise NotImplementedError(
            "This class should not be used directly, use the wrapping class SimpleIndexer"
        )


class SimpleIndexer(StaticStringIndexer):
    def __init__(self) -> None:
        super().__init__(RawSimpleIndexer())


class MockIndexer(SimpleIndexer):
    """
    Mock string indexer. Comes with a prepared set of strings.
    """
