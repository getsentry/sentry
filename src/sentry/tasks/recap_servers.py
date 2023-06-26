import urllib.parse
import uuid
from datetime import datetime
from typing import Any, Dict

import pytz
import urllib3
from django.db.models import Q

from sentry import http, options
from sentry.datascrubbing import scrub_data
from sentry.event_manager import EventManager
from sentry.models import Project, ProjectOption
from sentry.tasks import store
from sentry.tasks.base import instrumented_task
from sentry.utils import json

# from sentry.utils.assets import get_asset_url
# from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

# import sentry_sdk


# from sentry.utils.sdk import set_current_event_project

# TODO(recap): Add monitor check-in to make sure that polling works as expected
# TODO(recap): Add SDK context (project_id etc.) and metrics based on `tasks/store.py`

RECAP_SERVER_OPTION_KEY = "sentry:recap_server"
RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY = "sentry:recap_server_poll_id"


@instrumented_task(
    name="sentry.tasks.poll_recap_servers",
    queue="recap_servers",
)  # type: ignore
def poll_recap_servers(**kwargs) -> None:
    print("\n\n>>>", datetime.now(tz=pytz.UTC), "sentry.tasks.poll_recap_servers")  # NOQA: S002

    non_empty_filter = Q(value__exact="") | Q(value__isnull=True)
    project_ids = (
        ProjectOption.objects.filter(key=RECAP_SERVER_OPTION_KEY)
        .exclude(non_empty_filter)
        .values_list("project_id", flat=True)
    )

    print(">", "Found", len(project_ids), "projects with configured recap server")  # NOQA: S002

    for project_id in project_ids:
        # TODO(recap): Add feature flag?
        poll_project_recap_server.delay(project_id)


@instrumented_task(
    name="sentry.tasks.poll_project_recap_server",
    queue="recap_servers",
)  # type: ignore
def poll_project_recap_server(project_id: int, **kwargs) -> None:
    print(  # NOQA: S002
        ">>>", datetime.now(tz=pytz.UTC), "sentry.tasks.poll_project_recap_server:", project_id
    )

    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        # metrics.incr("recap_servers.missing_project")
        print(">", "Missing project:", project_id)  # NOQA: S002
        return

    recap_server = project.get_option(RECAP_SERVER_OPTION_KEY)
    # Just a guard in case someone removes recap url in the exact moment we trigger polling task
    if recap_server is None:
        return

    print(">", project, project_id)  # NOQA: S002
    print(">", "Configured recap server url:", recap_server)  # NOQA: S002

    latest_id = project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY, 0)
    print(">", "Most recent polled ID:", latest_id)  # NOQA: S002

    # TODO(recap): Remove me? Can we be certain that self-hosted recaps will use https and have valid certs?
    urllib3.disable_warnings()  # unsafe certificate

    url = recap_server.strip().rstrip("/") + "/rest/v1/crashes"
    # For non-initial queries, we want to filter for all events that happened _after_ our previously
    # fetched crashes, base on the most recent ID
    if latest_id != 0:
        # Apache Solr format requires us to encode the query.
        # Exclusive bounds range - {N TO *}
        url = url + urllib.parse.quote(f";q=id:{{{latest_id} TO *}}", safe=";=:")

    print("> Fetching JSON payload from:", url)  # NOQA: S002

    result = http.fetch_file(url, headers={"Accept": "*/*"}, verify_ssl=False)
    try:
        crashes = json.loads(result.body)
    except json.JSONDecodeError as e:
        # TODO(recap): Collect metrics about invalid responses instead?
        print("> Invalid JSON payload:", e)  # NOQA: S002
        return

    if crashes["results"] == 0:
        print("> No new crashes found:", url)  # NOQA: S002
        return

    print("> Found", crashes["results"], "new crashes")  # NOQA: S002
    latest_id = 0
    for crash in crashes["_embedded"]["crash"]:
        latest_id = max(latest_id, crash["id"])
        store_crash(crash, project, url)

    print("> Updating most recent ID to poll:", latest_id)  # NOQA: S002
    project.update_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY, latest_id)


def store_crash(crash, project: Project, url: str) -> None:
    # set_current_event_project(project_id)
    event = translate_crash_to_event(crash, project, url)

    if options.get("processing.can-use-scrubbers"):
        new_event = safe_execute(scrub_data, project=project, event=event, _with_transaction=False)
        if new_event is not None:
            event = new_event

    event_manager = EventManager(event, project=project)
    event_manager.normalize()

    store.save_event(
        project_id=project.id,
        event_id=event["event_id"],
        data=event_manager.get_data(),
    )


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
            "user": {"password": "should_be_redacted"},
        },
        "tags": {"url": url, "id": crash["id"]},
    }
