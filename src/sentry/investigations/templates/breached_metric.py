from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.investigations.templates.types import InvestigationTemplateSpec, TemplateBlockSpec

BREACHED_METRIC_TEMPLATE = InvestigationTemplateSpec(
    key="breached_metric",
    version=1,
    source_type=InvestigationSourceType.METRIC_OPEN_PERIOD,
    parameters=(),
    blocks=(
        TemplateBlockSpec(
            key="metric_chart",
            kind=InvestigationBlockKind.QUERY,
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
        TemplateBlockSpec(
            key="overview",
            kind=InvestigationBlockKind.TEXT,
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
        TemplateBlockSpec(
            key="synthesis",
            kind=InvestigationBlockKind.TEXT,
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
        TemplateBlockSpec(
            key="contributors",
            kind=InvestigationBlockKind.QUERY,
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
