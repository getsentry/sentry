from __future__ import annotations

from sentry.investigations.converters.notebook import (
    BlockSpec,
    ConvertedNotebook,
    write_converted_notebook,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationBlockKind,
    InvestigationSourceType,
)
from sentry.testutils.cases import TestCase


def _notebook(*blocks: BlockSpec, title: str = "Checkout crashes") -> ConvertedNotebook:
    return ConvertedNotebook(
        source_type=InvestigationSourceType.AUTOFIX,
        source_key="autofix:1",
        title=title,
        source={"type": InvestigationSourceType.AUTOFIX, "seerRunId": 1},
        blocks=blocks,
    )


ROOT_CAUSE = BlockSpec(
    "root_cause", InvestigationBlockKind.ROOT_CAUSE, "Root cause", {"headline": "Checkout crashes"}
)
SOLUTION = BlockSpec("solution", InvestigationBlockKind.SOLUTION, "Plan", {"steps": []})


class WriteConvertedNotebookTest(TestCase):
    def test_creates_notebook_with_blocks_in_order(self) -> None:
        investigation = write_converted_notebook(
            organization=self.organization, notebook=_notebook(ROOT_CAUSE, SOLUTION)
        )

        assert investigation.title == "Checkout crashes"
        assert investigation.source == {"type": "autofix", "seerRunId": 1}
        assert investigation.source_revision == 1
        blocks = list(
            InvestigationBlock.objects.filter(investigation=investigation).order_by("position")
        )
        assert [(b.stable_agent_key, b.position) for b in blocks] == [
            ("root_cause", 0),
            ("solution", 1),
        ]
        assert all(b.report_revision is None for b in blocks)

    def test_later_results_append_to_the_same_notebook(self) -> None:
        first = write_converted_notebook(
            organization=self.organization, notebook=_notebook(ROOT_CAUSE)
        )
        second = write_converted_notebook(
            organization=self.organization, notebook=_notebook(ROOT_CAUSE, SOLUTION)
        )

        assert first.id == second.id
        assert second.version == first.version + 1
        assert list(
            InvestigationBlock.objects.filter(investigation=first)
            .order_by("position")
            .values_list("stable_agent_key", flat=True)
        ) == ["root_cause", "solution"]

    def test_changed_block_is_updated_in_place(self) -> None:
        investigation = write_converted_notebook(
            organization=self.organization, notebook=_notebook(ROOT_CAUSE)
        )
        block = InvestigationBlock.objects.get(investigation=investigation)

        rewritten = BlockSpec(
            "root_cause",
            InvestigationBlockKind.ROOT_CAUSE,
            "Root cause",
            {"headline": "Checkout crashes on deleted products"},
        )
        write_converted_notebook(organization=self.organization, notebook=_notebook(rewritten))

        block.refresh_from_db()
        assert block.config == {"headline": "Checkout crashes on deleted products"}
        assert block.version == 2
        assert InvestigationBlock.objects.filter(investigation=investigation).count() == 1

    def test_unchanged_write_does_not_bump_versions(self) -> None:
        investigation = write_converted_notebook(
            organization=self.organization, notebook=_notebook(ROOT_CAUSE)
        )
        again = write_converted_notebook(
            organization=self.organization, notebook=_notebook(ROOT_CAUSE, title="Renamed")
        )

        assert again.version == investigation.version
        assert again.title == "Checkout crashes"
        assert InvestigationBlock.objects.get(investigation=investigation).version == 1

    def test_notebooks_are_separate_per_source_key(self) -> None:
        write_converted_notebook(organization=self.organization, notebook=_notebook(ROOT_CAUSE))
        other = ConvertedNotebook(
            source_type=InvestigationSourceType.AUTOFIX,
            source_key="autofix:2",
            title="Other",
            source={"type": InvestigationSourceType.AUTOFIX, "seerRunId": 2},
            blocks=[ROOT_CAUSE],
        )
        write_converted_notebook(organization=self.organization, notebook=other)

        assert (
            Investigation.objects.filter(
                organization=self.organization, source_type=InvestigationSourceType.AUTOFIX
            ).count()
            == 2
        )
