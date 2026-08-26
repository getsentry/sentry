from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.investigations.templates.types import InvestigationTemplateSpec, TemplateBlockSpec

SHORT_LINKED_SUMMARY_INSTRUCTIONS = (
    "Use at most three short sentences or three compact bullets total. Preserve useful Markdown "
    "links from the evidence. Link concrete Sentry issues, releases, transactions, or other pages "
    "when the evidence contains a valid URL or identifier; never invent a URL or identifier."
)
LINKED_EVIDENCE_INSTRUCTIONS = (
    "Include concise Markdown links to relevant Sentry issues, releases, transactions, or other "
    "pages when telemetry returns a concrete URL or identifier. Use organizationSlug from the "
    "investigation context for relative Sentry paths when needed; never guess a URL or identifier."
)

BREACHED_METRIC_TEMPLATE = InvestigationTemplateSpec(
    key="breached_metric",
    version=1,
    source_type=InvestigationSourceType.METRIC_OPEN_PERIOD,
    parameters=(),
    blocks=(
        TemplateBlockSpec(
            key="monitor_summary",
            kind=InvestigationBlockKind.TEXT,
            title="Monitor context",
            generation_prompt=(
                "Summarize only the Monitor details evidence for a human responder. State the "
                "monitor name and query, affected project and environment when known, threshold "
                "and breach direction, and supplied open-period time range. Do not speculate about "
                "the cause. " + SHORT_LINKED_SUMMARY_INSTRUCTIONS
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("monitor_evidence",),
        ),
        TemplateBlockSpec(
            key="monitor_evidence",
            kind=InvestigationBlockKind.QUERY,
            title="Monitor details",
            generation_prompt=(
                "Use the supplied metric issue, monitor definition, project, open-period window, "
                "threshold, and direction. Query the exact supplied monitor definition over the "
                "open period and an equal pre-breach baseline. Return a compact table of the "
                "monitor facts and the most useful baseline and open-period values. Preserve the "
                "exact query and time range; do not infer missing monitor configuration. "
                + LINKED_EVIDENCE_INSTRUCTIONS
            ),
            config={"autoRun": True},
            display={"version": 1, "type": "table", "defaultView": "table"},
        ),
        TemplateBlockSpec(
            key="spike_summary",
            kind=InvestigationBlockKind.TEXT,
            title="What happened",
            generation_prompt=(
                "Summarize only the Metric spike evidence. Describe when the ramp-up began, the "
                "peak value and time, how long the breach lasted, and whether the signal recovered "
                "or remained elevated. State uncertainty when sparse telemetry does not establish "
                "one of those facts. " + SHORT_LINKED_SUMMARY_INSTRUCTIONS
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("spike_evidence",),
        ),
        TemplateBlockSpec(
            key="spike_evidence",
            kind=InvestigationBlockKind.QUERY,
            title="Metric spike",
            generation_prompt=(
                "Query the exact supplied monitor definition over the supplied open period and an "
                "equal pre-breach baseline. Make the ramp-up, peak, and ramp-down or recovery "
                "visible in a time-series chart. Plot the observed metric and supplied threshold "
                "or comparison as separate series so the crossing is clear. Use the monitor time "
                "window for the chart interval when supported, and do not invent missing points. "
                + LINKED_EVIDENCE_INSTRUCTIONS
            ),
            config={"autoRun": True, "preferChart": True},
            display={"version": 1, "type": "table", "defaultView": "chart"},
            dependencies=("monitor_evidence",),
        ),
        TemplateBlockSpec(
            key="issues_summary",
            kind=InvestigationBlockKind.TEXT,
            title="What caused the spike",
            generation_prompt=(
                "Summarize only the Contributing issues evidence. Identify the issue groups that "
                "best account for the spike, including their counts, change from baseline, and "
                "relative contribution when available. If no issue groups convincingly explain "
                "the metric change, say that clearly. " + SHORT_LINKED_SUMMARY_INSTRUCTIONS
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("issues_evidence",),
        ),
        TemplateBlockSpec(
            key="issues_evidence",
            kind=InvestigationBlockKind.QUERY,
            title="Contributing issues",
            generation_prompt=(
                "Using the Metric spike evidence to preserve the spike window, compare issue-group "
                "telemetry during the open period with the equal pre-breach baseline. Rank issue "
                "groups by the strongest supported contribution using absolute counts, change "
                "from baseline, and share of the spike. Prefer a bar chart with a compact table "
                "when useful, and include issue links only when the telemetry provides valid ones. "
                "Treat no supporting issue groups as a valid result; never fabricate attribution. "
                + LINKED_EVIDENCE_INSTRUCTIONS
            ),
            config={"autoRun": True, "preferChart": True},
            display={"version": 1, "type": "table", "defaultView": "chart"},
            dependencies=("spike_evidence",),
        ),
        TemplateBlockSpec(
            key="tags_summary",
            kind=InvestigationBlockKind.TEXT,
            title="Why those issues spiked",
            generation_prompt=(
                "Summarize only the Issue tag changes evidence. Explain which dimensions changed "
                "most during the spike and what explanation, if any, those distribution changes "
                "support. Distinguish evidence from hypotheses and say when the slices do not "
                "establish a convincing explanation. " + SHORT_LINKED_SUMMARY_INSTRUCTIONS
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("tags_evidence",),
        ),
        TemplateBlockSpec(
            key="tags_evidence",
            kind=InvestigationBlockKind.QUERY,
            title="Issue tag changes",
            generation_prompt=(
                "Slice the contributing issue groups by supported dimensions that can explain the "
                "change, such as release, transaction, environment, region, browser, device, or "
                "other useful tags. Compare each distribution during the open period with the "
                "equal pre-breach baseline; do not rank raw spike volume without that comparison. "
                "Chart the strongest supported distribution changes and retain a compact table "
                "when useful. Do not invent unavailable tags or claim causation from correlation. "
                + LINKED_EVIDENCE_INSTRUCTIONS
            ),
            config={"autoRun": True, "preferChart": True},
            display={"version": 1, "type": "table", "defaultView": "chart"},
            dependencies=("issues_evidence",),
        ),
        TemplateBlockSpec(
            key="trigger_summary",
            kind=InvestigationBlockKind.TEXT,
            title="Likely trigger and next steps",
            generation_prompt=(
                "Summarize only the Release and infrastructure signals evidence. Classify the "
                "result as code-related, infrastructure-related, mixed, or insufficient evidence. "
                "Distinguish correlation from causation, name the strongest supported finding, and "
                "give concrete next steps a human can take. Present external observability checks "
                "as suggestions rather than findings. " + SHORT_LINKED_SUMMARY_INSTRUCTIONS
            ),
            config={"autoRun": True},
            display={"type": "markdown"},
            dependencies=("trigger_evidence",),
        ),
        TemplateBlockSpec(
            key="trigger_evidence",
            kind=InvestigationBlockKind.QUERY,
            title="Release and infrastructure signals",
            generation_prompt=(
                "Use the supplied spike window together with the contributing issue and tag "
                "evidence. Check supported Sentry telemetry for releases, deployments, affected "
                "services or transactions, and infrastructure-like patterns correlated with the "
                "change. Return a compact evidence table containing only observed signals and "
                "their timing. If Sentry cannot inspect relevant infrastructure directly, include "
                "specific suggested external checks such as affected pods or services in Datadog, "
                "clearly labeled as follow-up checks rather than findings. Never fabricate release, "
                "deployment, infrastructure, or external-observability data. "
                + LINKED_EVIDENCE_INSTRUCTIONS
            ),
            config={"autoRun": True},
            display={"version": 1, "type": "table", "defaultView": "table"},
            dependencies=("spike_evidence", "issues_evidence", "tags_evidence"),
        ),
    ),
)
