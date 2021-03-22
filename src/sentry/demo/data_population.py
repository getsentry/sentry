import copy
import logging
import functools
import random
import pytz
import time

from collections import defaultdict
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from uuid import uuid4
from typing import List

from sentry.interfaces.user import User as UserInterface
from sentry.models import Project
from sentry.utils import json
from sentry.utils.dates import to_timestamp
from sentry.utils.samples import (
    random_geo,
    random_ip,
    create_sample_event_basic,
    random_normal,
)
from sentry.utils.snuba import SnubaError


MAX_DAYS = settings.DEMO_DATA_GEN_PARAMS["MAX_DAYS"]
SCALE_FACTOR = settings.DEMO_DATA_GEN_PARAMS["SCALE_FACTOR"]
BASE_OFFSET = settings.DEMO_DATA_GEN_PARAMS["BASE_OFFSET"]
NAME_STEP_SIZE = settings.DEMO_DATA_GEN_PARAMS["NAME_STEP_SIZE"]
BREADCRUMB_LOOKBACK_TIME = settings.DEMO_DATA_GEN_PARAMS["BREADCRUMB_LOOKBACK_TIME"]
DEFAULT_BACKOFF_TIME = settings.DEMO_DATA_GEN_PARAMS["DEFAULT_BACKOFF_TIME"]
ERROR_BACKOFF_TIME = settings.DEMO_DATA_GEN_PARAMS["ERROR_BACKOFF_TIME"]


logger = logging.getLogger(__name__)


def get_event_from_file(file_path):
    with open(file_path) as f:
        return clean_event(json.load(f))


def distribution_v1(hour: int) -> int:
    if hour > 9 and hour < 12:
        return 8
    if hour > 6 and hour < 15:
        return 3
    if hour > 4 and hour < 20:
        return 2
    return 1


def distribution_v2(hour: int) -> int:
    if hour > 18 and hour < 20:
        return 22
    if hour > 9 and hour < 14:
        return 7
    if hour > 3 and hour < 22:
        return 4
    return 2


def distribution_v3(hour: int) -> int:
    if hour > 21:
        return 11
    if hour > 6 and hour < 15:
        return 6
    if hour > 3:
        return 2
    return 1


distrubtion_fns = [distribution_v1, distribution_v2, distribution_v3]


@functools.lru_cache(maxsize=None)
def get_list_of_names() -> List[str]:
    with open("src/sentry/demo/data/names.json") as f:
        return json.load(f)


# create a cache by user id so we can can consistent
# ip addresses and geos for a user
@functools.lru_cache(maxsize=10 * 1000)
def get_user_by_id(id_0_offset):
    name_list = get_list_of_names()
    name = name_list[id_0_offset]
    email = f"{name.lower()}@example.com"
    return UserInterface.to_python(
        {
            "id": id_0_offset + 1,
            "email": email,
            "ip_address": random_ip(),
            "name": name,
            "geo": random_geo(),
        }
    ).to_json()


def generate_user():
    name_list = get_list_of_names()
    id_0_offset = random.randrange(0, len(name_list), NAME_STEP_SIZE)
    return get_user_by_id(id_0_offset)


def safe_send_event(data):
    project = data.pop("project")
    # TODO: make a batched update version of create_sample_event
    try:
        create_sample_event_basic(data, project.id)
        time.sleep(DEFAULT_BACKOFF_TIME)
    except SnubaError:
        # if snuba fails, just back off and continue
        logger.info("safe_send_event.snuba_error")
        time.sleep(ERROR_BACKOFF_TIME)


def clean_event(event_json):
    # clear out these fields if they exist
    fields_to_delete = [
        "datetime",
        "timestamp",
        "start_timestamp",
        "location",
        "title",
        "event_id",
        "project",
    ]
    for field in fields_to_delete:
        if field in event_json:
            del event_json[field]

        # delete in spans as well
        for span in event_json.get("spans", []):
            if field in span:
                del span[field]

    # delete request header since they have data that won't match
    # the generated data
    request = event_json.get("request")
    if request and "headers" in request:
        del request["headers"]

    return event_json


def fix_timestamps(event_json):
    """
    Convert a time zone aware datetime timestamps to a POSIX timestamp
    for an evnet
    """
    event_json["timestamp"] = to_timestamp(event_json["timestamp"])
    start_timestamp = event_json.get("start_timestamp")
    if start_timestamp:
        event_json["start_timestamp"] = to_timestamp(start_timestamp)


def fix_error_event(event_json):
    fix_timestamps(event_json)
    fix_breadrumbs(event_json)


def fix_transaction_event(event_json, old_span_id):
    fix_timestamps(event_json)
    fix_spans(event_json, old_span_id)
    fix_measurements(event_json)


def fix_spans(event_json, old_span_id):
    """
    This function does the folowing:
    1. Give spans fresh span_ids & update the parent span ids accordingly
    2. Update span offsets and durations based on transaction duration and some randomness
    """
    trace = event_json["contexts"]["trace"]
    new_span_id = trace["span_id"]
    trace_id = trace["trace_id"]

    update_id_map = {old_span_id: new_span_id}
    spans = event_json.get("spans", [])

    full_duration = event_json["timestamp"] - event_json["start_timestamp"]

    while True:
        found_any = False
        for span in spans:
            new_parent_id = update_id_map.get(span["parent_span_id"])
            if new_parent_id:
                # set the new parent
                span["parent_span_id"] = new_parent_id

                # generate a new id and set the replacement mappping
                new_id = uuid4().hex[:16]
                update_id_map[span["span_id"]] = new_id

                # update the spn
                span["span_id"] = new_id

                found_any = True

        # quit if we didn't make any updates
        if not found_any:
            break

    # now update every trace id
    for span in spans:
        span["trace_id"] = trace_id

    # create a tree of children and a hashmap of the span by the ID
    tree = defaultdict(list)
    id_map = {}
    for span in spans:
        tree[span["parent_span_id"]].append(span)
        id_map[span["span_id"]] = span

    id_list = [new_span_id]
    while id_list:
        span_id = id_list.pop()
        children = tree.get(span_id, [])

        # figure out the offset of the parent span and the end time of the span
        if span_id == new_span_id:
            span_offset = 0
            parent_duration = full_duration
            end_of_parent_span = full_duration
        else:
            parent_span = id_map[span_id]
            span_offset = parent_span["data"]["offset"]
            parent_duration = parent_span["data"]["duration"]

        # end time of the parent span is the offset + duration
        end_of_parent_span = span_offset + parent_duration

        num_children = len(children)
        avg_span_length = parent_duration / max(num_children, 1)

        # order each span with the same parent sequentially in time
        for i, span in enumerate(children):
            if "data" not in span:
                span["data"] = {}

            span["data"]["offset"] = span_offset
            remaining_time = end_of_parent_span - span_offset
            # if we are the last child of a span, then
            last_index = num_children - 1
            if i == last_index:
                duration = remaining_time
            else:
                # the max duration should give some breathging room to the remaining spans
                max_duration = remaining_time - (avg_span_length / 4.0) * (last_index - i)
                # pick a random length for the span that's at most 2x the average span length
                duration = min(max_duration, random.uniform(0, 2 * avg_span_length))
            span["data"]["duration"] = duration
            span["start_timestamp"] = event_json["start_timestamp"] + span_offset
            span.setdefault("timestamp", span["start_timestamp"] + duration)
            # calcualate the next span offset
            span_offset = duration + span_offset
            id_list.append(span["span_id"])


def fix_measurements(event_json):
    """
    Convert measurment data from durations into timestamps
    """
    measurements = event_json.get("measurements")

    if measurements:
        measurement_markers = {}
        for key, entry in measurements.items():
            if key in ["fp", "fcp", "lcp", "fid"]:
                measurement_markers[f"mark.{key}"] = {
                    "value": round(event_json["start_timestamp"] + entry["value"] / 1000, 3)
                }
        measurements.update(measurement_markers)


def fix_breadrumbs(event_json):
    """
    Fixes the timestamps on breadcrumbs to match the current time
    Evenly spaces out all breadcrumbs starting at BREADCRUMB_LOOKBACK_TIME ago
    """
    breadcrumbs = event_json.get("breadcrumbs", {}).get("values", [])
    num_breadcrumbs = len(breadcrumbs)
    breadcrumb_time_step = BREADCRUMB_LOOKBACK_TIME * 1.0 / num_breadcrumbs

    curr_time = event_json["timestamp"] - BREADCRUMB_LOOKBACK_TIME
    for breadcrumb in breadcrumbs:
        breadcrumb["timestamp"] = curr_time
        curr_time += breadcrumb_time_step


def populate_connected_event_scenario_1(react_project: Project, python_project: Project):
    """
    This function populates a set of four related events with the same trace id:
    - Front-end transaction
    - Front-end error
    - Back-end transaction
    - Back-end error
    Occurrance times and durations are randomized
    """
    react_transaction = get_event_from_file("src/sentry/demo/data/react_transaction_1.json")
    react_error = get_event_from_file("src/sentry/demo/data/react_error_1.json")
    python_transaction = get_event_from_file("src/sentry/demo/data/python_transaction_1.json")
    python_error = get_event_from_file("src/sentry/demo/data/python_error_1.json")

    log_extra = {
        "organization_slug": react_project.organization.slug,
        "MAX_DAYS": MAX_DAYS,
        "SCALE_FACTOR": SCALE_FACTOR,
    }
    logger.info("populate_connected_event_scenario_1.start", extra=log_extra)

    for day in range(MAX_DAYS):
        for hour in range(24):
            base = distribution_v1(hour)
            # determine the number of events we want in this hour
            num_events = int((BASE_OFFSET + SCALE_FACTOR * base) * random.uniform(0.6, 1.0))
            for i in range(num_events):
                logger.info(
                    "populate_connected_event_scenario_1.send_event_series", extra=log_extra
                )

                # pick the minutes randomly (which means events will sent be out of order)
                minute = random.randint(0, 60)
                timestamp = timezone.now() - timedelta(days=day, hours=hour, minutes=minute)
                timestamp = timestamp.replace(tzinfo=pytz.utc)
                transaction_user = generate_user()
                trace_id = uuid4().hex

                old_span_id = react_transaction["contexts"]["trace"]["span_id"]
                frontend_root_span_id = uuid4().hex[:16]
                frontend_duration = random_normal(2000 - 50 * day, 250, 1000) / 1000.0

                frontend_context = {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id,
                        "span_id": frontend_root_span_id,
                    }
                }

                # React transaction
                local_event = copy.deepcopy(react_transaction)
                local_event.update(
                    project=react_project,
                    platform=react_project.platform,
                    event_id=uuid4().hex,
                    user=transaction_user,
                    timestamp=timestamp,
                    # start_timestamp decreases based on day so that there's a trend
                    start_timestamp=timestamp - timedelta(seconds=frontend_duration),
                    measurements={
                        "fp": {"value": random_normal(1250 - 50 * day, 200, 500)},
                        "fcp": {"value": random_normal(1250 - 50 * day, 200, 500)},
                        "lcp": {"value": random_normal(2800 - 50 * day, 400, 2000)},
                        "fid": {"value": random_normal(5 - 0.125 * day, 2, 1)},
                    },
                    contexts=frontend_context,
                )

                fix_transaction_event(local_event, old_span_id)
                safe_send_event(local_event)

                # note picking the 0th span is arbitrary
                backend_parent_id = local_event["spans"][0]["span_id"]

                # React error
                local_event = copy.deepcopy(react_error)
                local_event.update(
                    project=react_project,
                    platform=react_project.platform,
                    timestamp=timestamp,
                    user=transaction_user,
                    contexts=frontend_context,
                )
                fix_error_event(local_event)
                safe_send_event(local_event)

                # python transaction
                old_span_id = python_transaction["contexts"]["trace"]["span_id"]
                backend_duration = random_normal(1500 + 50 * day, 250, 500)

                backend_context = {
                    "trace": {
                        "type": "trace",
                        "trace_id": trace_id,
                        "span_id": uuid4().hex[:16],
                        "parent_span_id": backend_parent_id,
                    }
                }

                local_event = copy.deepcopy(python_transaction)
                local_event.update(
                    project=python_project,
                    platform=python_project.platform,
                    timestamp=timestamp,
                    start_timestamp=timestamp - timedelta(milliseconds=backend_duration),
                    user=transaction_user,
                    contexts=backend_context,
                )
                fix_transaction_event(local_event, old_span_id)
                safe_send_event(local_event)

                # python error
                local_event = copy.deepcopy(python_error)
                local_event.update(
                    project=python_project,
                    platform=python_project.platform,
                    timestamp=timestamp,
                    user=transaction_user,
                    contexts=backend_context,
                )
                fix_error_event(local_event)
                safe_send_event(local_event)
    logger.info("populate_connected_event_scenario_1.finished", extra=log_extra)
