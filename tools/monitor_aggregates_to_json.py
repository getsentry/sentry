#!/usr/bin/env python3
import json

OUTPUT_PATH = "static/app/views/detectors/monitorAggregates.generated.json"


def render() -> str:
    from sentry.workflow_engine.endpoints.validators.metric_data_source_schema import (
        EAP_MONITOR_FUNCTIONS,
    )

    return json.dumps(EAP_MONITOR_FUNCTIONS, indent=2) + "\n"


def main() -> int:
    from sentry.runner import configure

    configure()

    with open(OUTPUT_PATH, "w") as f:
        f.write(render())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
