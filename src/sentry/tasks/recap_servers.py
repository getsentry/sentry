import uuid

# from typing import Optional
from datetime import datetime

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

    # TODO(recap): Should we double-check that received values are _always_ a valid URL and that they are not empty?
    for project_id in project_ids:
        # TODO(recap): Add some feature flagging and early-adopters?
        # if features.has("project:recap-server", project_id):
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
    print(">", project, project_id)  # NOQA: S002
    print(">", "Configured recap server url:", recap_server)  # NOQA: S002

    latest_id = project.get_option(RECAP_SERVER_MOST_RECENT_POLLED_ID_KEY, 0)
    print(">", "Most recent polled ID:", latest_id)  # NOQA: S002

    # TODO(recap): Remove me
    urllib3.disable_warnings()  # unsafe certificate

    # We want to make sure that our initial /crashes query is *inclusive* with id:0
    if latest_id == 0:
        bound_type = "%5B"  # Inclusive bound - [
    else:
        bound_type = "%7B"  # Exclusive bound - {

    url = (
        recap_server.strip().rstrip("/")
        + "/rest/v1/crashes;q=id:"
        + bound_type
        + str(latest_id)
        + "%20TO%20*%5D"
    )
    print("> Fetching JSON payload from:", url)  # NOQA: S002

    result = http.fetch_file(url, headers={"Accept": "*/*"}, verify_ssl=False)
    crashes = json.loads(result.body)

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

    event = {
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

    project_id = event["project"]
    event_id = event["event_id"]

    # set_current_event_project(project_id)

    if options.get("processing.can-use-scrubbers"):
        new_event = safe_execute(scrub_data, project=project, event=event, _with_transaction=False)

        if new_event is not None:
            event = new_event

    event_manager = EventManager(event, project=Project(id=project_id))
    event_manager.normalize(project_id)
    data = event_manager.get_data()

    store.save_event(
        project_id=project_id,
        event_id=event_id,
        data=data,
    )
