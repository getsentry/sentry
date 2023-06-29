import logging
import urllib.parse
import uuid
from typing import Any, Dict

from sentry import http, options
from sentry.datascrubbing import scrub_data
from sentry.event_manager import EventManager
from sentry.models import Project, ProjectOption
from sentry.tasks.base import instrumented_task
from sentry.utils import json
from sentry.utils.safe import safe_execute

# TODO(recap): Add monitor check-in to make sure that polling works as expected.

# NOTE: Currently there's an assumption that we won't be serving thousands of projects using this feature.
# If that changes in the future, we should add a timing metrics to the task below and make sure to add
# appropriate alerts for Sentry in case the transaction's duration takes significant time (~>30s).

# NOTE: Should we restore `RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY` to 0 when recap server url changes?
# Preferably we'd keep track of server_identity<->latest_id mappings in the future.

# NOTE: Instead of using "legacy" `eventstore`, we can think about going through Relay, using project_key
# (see: sentry/utils/sdk.py) and mimick sending data as a regular SDK event payload.


RECAP_SERVER_OPTION_KEY = "sentry:recap_server"
RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY = "sentry:recap_server_poll_id"

logger = logging.getLogger(__name__)


# TODO(recap): Add feature flag?
@instrumented_task(
    name="sentry.tasks.poll_recap_servers",
    queue="recap_servers",
)
def poll_recap_servers(**kwargs):
    project_ids = (
        ProjectOption.objects.filter(key=RECAP_SERVER_OPTION_KEY)
        .exclude(value__isnull=True)
        .values_list("project_id", flat=True)
    )

    for project_id in project_ids:
        poll_project_recap_server.delay(project_id)


@instrumented_task(
    name="sentry.tasks.poll_project_recap_server",
    queue="recap_servers",
)
def poll_project_recap_server(project_id: int, **kwargs) -> None:
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        logger.warning("Polled project do not exist", extra={project_id: project_id})
        return

    recap_server = project.get_option(RECAP_SERVER_OPTION_KEY)
    # Just a guard in case someone removes recap url in the exact moment we trigger polling task
    if recap_server is None:
        logger.warning(
            "Polled project has no recap server url configured", extra={project: project}
        )
        return

    latest_id = project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY, 0)
    url = recap_server.strip().rstrip("/") + "/rest/v1/crashes"

    # For non-initial queries, we want to filter for all events that happened _after_ our previously
    # fetched crashes, base on the most recent ID
    if latest_id != 0:
        # Apache Solr format requires us to encode the query.
        # Exclusive bounds range - {N TO *}
        url = url + urllib.parse.quote(f";q=id:{{{latest_id} TO *}}", safe=";=:")

    result = http.fetch_file(url, headers={"Accept": "*/*"}, verify_ssl=False)

    try:
        crashes = json.loads(result.body)
        if not isinstance(crashes, dict):
            raise json.JSONDecodeError
    except json.JSONDecodeError as exc:
        logger.exception(
            "Polled project endpoint did not responded with valid json",
            exc_info=exc,
            extra={project: project, url: url},
        )
        return

    if crashes.get("results") is None or crashes.get("results") == 0:
        return

    for crash in crashes["_embedded"]["crash"]:
        latest_id = max(latest_id, crash["id"])
        store_crash(crash, project, url)

    project.update_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY, latest_id)


def store_crash(crash, project: Project, url: str) -> None:
    try:
        event = translate_crash_to_event(crash, project, url)
    except KeyError as exc:
        logger.exception(
            "Crash dump data has invalid payload", exc_info=exc, extra={project: project, url: url}
        )
        return

    if options.get("processing.can-use-scrubbers"):
        new_event = safe_execute(scrub_data, project=project, event=event, _with_transaction=False)
        if new_event is not None:
            event = new_event

    event_manager = EventManager(event, project=project)
    event_manager.save(project_id=project.id)


def translate_crash_to_event(crash, project: Project, url: str) -> Dict[str, Any]:
    # processed_stacktrace = []
    # for frame in payload["detailedStackTrace"]:
    #     processed_frame = {
    #         "filename": frame["sourceFile"],
    #         "lineno": frame["sourceLine"],
    #         "instruction_addr": frame["absoluteAddress"],
    #         "module": frame["moduleName"],
    #         "function": frame["resolvedSymbol"],
    #         "raw_function": frame["displayValue"],
    #     }
    #     processed_stacktrace.append(processed_frame)

    # detailed_st = {}
    # for count, value in enumerate(payload["detailedStackTrace"]):
    #     detailed_st["frame" + str(count)] = value

    return {
        "event_id": uuid.uuid4().hex,
        "project": project.id,
        "exception": {
            "values": [
                {
                    "type": crash["stopReason"],
                    "value": "Unknown exception (id#{})".format(crash["id"]),
                    # "stacktrace": {
                    #     "frames": processed_stacktrace,
                    # },
                }
            ]
        },
        "contexts": {
            "_links": crash["_links"],
            # "detailedStackTrace": detailed_st,
        },
        "tags": {"url": url, "crash_id": crash["id"]},
    }
