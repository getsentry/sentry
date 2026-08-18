from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.investigations.templates.types import InvestigationTemplateSpec, TemplateBlockSpec

BREACHED_METRIC_TEMPLATE_V1 = InvestigationTemplateSpec(
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


BREACHED_METRIC_TEMPLATE = InvestigationTemplateSpec(
    key="breached_metric",
    version=2,
    source_type=InvestigationSourceType.METRIC_OPEN_PERIOD,
    parameters=(),
    blocks=(
        TemplateBlockSpec(
            key="summary",
            kind=InvestigationBlockKind.TEXT,
            title="Investigation summary",
            generation_prompt=(
                "Summarize the completed breached-metric investigation for a reader who has not "
                "seen the supporting cells. Lead with what changed and whether the metric remains "
                "breached, then name the strongest evidenced contributors. Distinguish established "
                "facts from hypotheses, call out important data gaps, and end with the most useful "
                "next action. Use concise markdown with short paragraphs or bullets and do not "
                "repeat raw tables."
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("metric_chart", "overview", "contributors", "synthesis"),
        ),
        TemplateBlockSpec(
            key="overview",
            kind=InvestigationBlockKind.TEXT,
            title="Breach context",
            generation_prompt=(
                "Orient the reader to this breached metric using the supplied monitor, open period, "
                "project, aggregate, query, threshold, direction, and analysis window. State exactly "
                "what condition opened the incident and what comparison period will be used. Do not "
                "claim a cause before examining telemetry. Keep this to two short paragraphs."
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
        ),
        TemplateBlockSpec(
            key="metric_chart",
            kind=InvestigationBlockKind.QUERY,
            title="Breach timeline",
            generation_prompt=(
                "Query the exact supplied monitor definition across the complete supplied analysis "
                "window. Preserve the monitor aggregate, filters, group-by, environment, and time "
                "window. Produce a time-series view with enough resolution to show the baseline, "
                "threshold crossing, peak or trough, and latest observed value. Plot the observed "
                "metric and supplied static threshold as separate series when the chart schema "
                "supports it; otherwise state the threshold clearly in the result."
            ),
            config={"autoRun": True, "preferChart": True},
            display={"version": 1, "type": "table", "defaultView": "chart"},
        ),
        TemplateBlockSpec(
            key="contributors",
            kind=InvestigationBlockKind.QUERY,
            title="Contributing signals",
            generation_prompt=(
                "Compare the supplied open-period window with its equal pre-breach baseline. Start "
                "from the monitor's dataset and query, then use supported telemetry calls and local "
                "transformations to test which issue groups, tags, transactions, spans, logs, or "
                "other dimensions account for the change. Rank contributors by absolute and relative "
                "change, chart the strongest available evidence, and explicitly report when no "
                "dimension convincingly explains the breach."
            ),
            config={"autoRun": True, "preferChart": True},
            display={"version": 1, "type": "table", "defaultView": "chart"},
            dependencies=("metric_chart",),
        ),
        TemplateBlockSpec(
            key="synthesis",
            kind=InvestigationBlockKind.TEXT,
            title="What explains the change",
            generation_prompt=(
                "Explain what the breach timeline and contributor analysis establish together. "
                "Quantify the clearest changes, separate correlation from causation, identify "
                "conflicting evidence, and state whether the telemetry supports a likely explanation. "
                "If it does not, say what evidence is missing. Keep the answer to two or three short "
                "paragraphs unless a tiny table is essential."
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("metric_chart", "contributors"),
        ),
    ),
)
