#!/usr/bin/env python3
OUTPUT_PATH = "static/app/views/detectors/monitorAggregates.generated.ts"


def render() -> str:
    from sentry.workflow_engine.endpoints.validators.metric_data_source_schema import (
        EAP_MONITOR_FUNCTIONS,
    )

    lines = [
        "/**",
        " * GENERATED FILE. Do not edit manually.",
        " * To update it run `python3 -m tools.monitor_aggregates_to_typescript`",
        " *",
        " * The functions that metric monitors accept for each EAP dataset, from",
        " * EAP_MONITOR_FUNCTIONS in metric_data_source_schema.py.",
        " *",
        " * DEPLOYMENT: This is safe to deploy alongside backend changes.",
        " */",
        "",
        "export const MONITOR_AGGREGATES = {",
    ]
    for dataset, functions in EAP_MONITOR_FUNCTIONS.items():
        lines.append(f"  {dataset}: [")
        lines.extend(f"    '{function}'," for function in functions)
        lines.append("  ],")
    lines.append("} as const;")
    return "\n".join(lines) + "\n"


def main() -> int:
    from sentry.runner import configure

    configure()

    with open(OUTPUT_PATH, "w") as f:
        f.write(render())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
