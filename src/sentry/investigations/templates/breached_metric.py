from sentry.investigations.models import (
    InvestigationCellKind,
    InvestigationParameterType,
    InvestigationSourceType,
)
from sentry.investigations.templates.types import (
    InvestigationTemplateSpec,
    TemplateCellSpec,
    TemplateParameterSpec,
)

BREACHED_METRIC_TEMPLATE = InvestigationTemplateSpec(
    key="breached_metric",
    version=1,
    source_type=InvestigationSourceType.BREACHED_METRIC,
    parameters=(
        TemplateParameterSpec(
            key="timeRange",
            label="Time range",
            description="The period around the metric breach to investigate.",
            type=InvestigationParameterType.DATETIME_RANGE,
            required=True,
            constraints={"maxDays": 90},
        ),
        TemplateParameterSpec(
            key="environments",
            label="Environments",
            description="Optional environments to include in the investigation.",
            type=InvestigationParameterType.ENVIRONMENT_LIST,
            default_value=[],
            constraints={"maxItems": 20},
        ),
    ),
    cells=(
        TemplateCellSpec(
            key="goal",
            kind=InvestigationCellKind.TEXT,
            title="Investigation goal",
            content=(
                "## Investigation goal\n\n"
                "Understand why **{group_title}** breached its expected metric."
            ),
            display={"type": "markdown"},
        ),
        TemplateCellSpec(
            key="trend",
            kind=InvestigationCellKind.QUERY,
            title="Metric trend",
            generation_prompt=(
                "Build a Sentry query that compares the breached metric before and after "
                "the breach for the selected time range and environments."
            ),
            config={"datasetHint": "metrics"},
            display={"version": 1, "type": "table", "defaultView": "table"},
            dependencies=("goal",),
            parameters=("timeRange", "environments"),
        ),
        TemplateCellSpec(
            key="explanation",
            kind=InvestigationCellKind.TEXT,
            title="What changed",
            generation_prompt=(
                "Explain the most important change in the metric trend and summarize the "
                "likely contributing dimensions."
            ),
            config={"datasetHint": "metrics"},
            display={"type": "markdown"},
            dependencies=("trend",),
            parameters=("timeRange", "environments"),
        ),
        TemplateCellSpec(
            key="contributors",
            kind=InvestigationCellKind.QUERY,
            title="Contributing dimensions",
            generation_prompt=(
                "Build a follow-up Sentry query that breaks the regression down by release, "
                "environment, and transaction."
            ),
            display={"version": 1, "type": "table", "defaultView": "table"},
            dependencies=("trend", "explanation"),
            parameters=("timeRange", "environments"),
        ),
    ),
)
