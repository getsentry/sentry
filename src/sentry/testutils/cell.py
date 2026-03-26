from __future__ import annotations

from collections.abc import Collection, Generator, Sequence
from contextlib import contextmanager

from django.test import override_settings

from sentry.types.cell import Cell, CellDirectory, Locality, get_global_directory


class TestEnvCellDirectory(CellDirectory):
    __test__ = False

    def __init__(self, cells: Collection[Cell]) -> None:
        super().__init__(cells, frozenset())
        self._default_cell = next(iter(cells))
        self._apply_cells(cells)

    def _apply_cells(self, cells: Collection[Cell]) -> None:
        localities = frozenset(
            Locality(
                name=c.name,
                cells=frozenset([c.name]),
                category=c.category,
                visible=c.visible,
                new_org_cell=c.name,
            )
            for c in cells
        )
        self._cells = frozenset(cells)
        self._by_name = {c.name: c for c in self._cells}
        self._localities = localities
        self._localities_by_name = {loc.name: loc for loc in localities}
        self._cell_to_locality = {cell_name: loc for loc in localities for cell_name in loc.cells}

    @contextmanager
    def swap_state(
        self,
        cells: Sequence[Cell],
        local_cell: Cell | None = None,
    ) -> Generator[None]:
        prev_state = (
            self._default_cell,
            self._cells,
            self._by_name,
            self._localities,
            self._localities_by_name,
            self._cell_to_locality,
        )
        try:
            self._default_cell = local_cell or cells[0]
            self._apply_cells(cells)
            monolith_cell = cells[0]
            with override_settings(SENTRY_MONOLITH_REGION=monolith_cell.name):
                if local_cell:
                    with override_settings(SENTRY_REGION=local_cell.name):
                        yield
                else:
                    yield
        finally:
            (
                self._default_cell,
                self._cells,
                self._by_name,
                self._localities,
                self._localities_by_name,
                self._cell_to_locality,
            ) = prev_state

    @contextmanager
    def swap_to_default_cell(self) -> Generator[None]:
        """Swap to the monolith cell when entering cell mode."""
        with override_settings(SENTRY_REGION=self._default_cell.name):
            yield

    @contextmanager
    def swap_to_cell_by_name(self, cell_name: str) -> Generator[None]:
        """Swap to the specified cell when entering cell mode."""
        cell = self.get_cell_by_name(cell_name)
        if cell is None:
            raise Exception("specified swap cell not found")
        with override_settings(SENTRY_REGION=cell.name):
            yield


def get_test_env_directory() -> TestEnvCellDirectory:
    directory = get_global_directory()
    assert isinstance(directory, TestEnvCellDirectory)
    return directory


@contextmanager
def override_cells(cells: Sequence[Cell], local_cell: Cell | None = None) -> Generator[None]:
    """Override the global set of existing cells.

    The overriding value takes the place of the `SENTRY_REGION_CONFIG` setting and
    changes the behavior of the module-level functions in `sentry.types.cell`. This
    is preferable to overriding the `SENTRY_REGION_CONFIG` setting value directly
    because the cell mapping may already be cached.
    """
    with get_test_env_directory().swap_state(cells, local_cell=local_cell):
        yield


# TODO(cells): Remove alias once no longer used in getsentry
override_regions = override_cells
