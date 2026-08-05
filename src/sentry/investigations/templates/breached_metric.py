from sentry.investigations.models import InvestigationCellKind, InvestigationSourceType
from sentry.investigations.templates.types import InvestigationTemplateSpec, TemplateCellSpec

BREACHED_METRIC_TEMPLATE = InvestigationTemplateSpec(
    key="breached_metric",
    version=1,
    source_type=InvestigationSourceType.BREACHED_METRIC,
    parameters=(),
    cells=(
        TemplateCellSpec(
            key="metric_chart",
            kind=InvestigationCellKind.QUERY,
            title="Breached metric",
            generation_prompt=(
                "Query the exact supplied monitor definition over the supplied analysis window. "
                "Make the breach immediately visible in a time-series chart spanning the equal "
                "pre-breach baseline and open-period portions. Plot the observed metric and the "
                "supplied threshold or comparison as separate series so the crossing is clear. "
                "Use the monitor time window for the chart interval when supported."
            ),
            config={"autoRun": True, "preferChart": True},
            display={"version": 1, "type": "table", "defaultView": "chart"},
        ),
        TemplateCellSpec(
            key="overview",
            kind=InvestigationCellKind.TEXT,
            title="Overview",
            generation_prompt=(
                "Give the reader a useful overview of this breached metric using the supplied "
                "monitor, open-period, project, threshold, direction, and analysis-window facts. "
                "Accurately describe whether this is an upward or downward breach. Do not claim a "
                "cause before examining the telemetry. Keep the overview to two short paragraphs."
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
        ),
        TemplateCellSpec(
            key="synthesis",
            kind=InvestigationCellKind.TEXT,
            title="What explains the change",
            generation_prompt=(
                "Explain what the breached-metric result above and contributor result below show "
                "together. Focus on evidence, distinguish correlation from causation, and state "
                "uncertainty when the telemetry does not establish a convincing explanation. Keep "
                "the answer to two or three short paragraphs unless a tiny table is essential."
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("metric_chart", "contributors"),
        ),
        TemplateCellSpec(
            key="contributors",
            kind=InvestigationCellKind.QUERY,
            title="Likely contributors",
            generation_prompt=(
                "Compare telemetry during the supplied open-period window with its equal baseline. "
                "Use as many supported telemetry calls and local transformations as useful. Let "
                "the evidence determine whether issue groups, tags, or other metadata best explain "
                "the change, then chart the strongest available evidence. If no convincing "
                "contributor exists, show the most useful evidence and say so in the result."
            ),
            config={"autoRun": True, "preferChart": True},
            display={"version": 1, "type": "table", "defaultView": "chart"},
        ),
    ),
)
