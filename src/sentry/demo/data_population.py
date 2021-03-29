import copy
import logging
import functools
import os
import random
import pytz
import time

from collections import defaultdict
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from hashlib import sha1
from uuid import uuid4
from typing import List

from sentry.interfaces.user import User as UserInterface
from sentry.models import (
    File,
    Project,
    Release,
    Repository,
    CommitAuthor,
    Commit,
    ReleaseFile,
    CommitFileChange,
    ReleaseCommit,
)
from sentry.utils import json, loremipsum
from sentry.utils.dates import to_timestamp
from sentry.utils.samples import (
    random_geo,
    random_ip,
    create_sample_event_basic,
    random_normal,
)
from sentry.utils.snuba import SnubaError


commit_message_base_messages = [
    "feat: Do something to",
    "feat: Update code in",
    "ref: Refactor code in",
    "fix: Fix bug in",
]

base_paths_by_file_type = {"js": ["components/", "views/"], "py": ["flask/", "routes/"]}


logger = logging.getLogger(__name__)


def get_config(quick):
    """
    Returns the data generation config
    Depends on if we are doing a quick-gen or not
    """
    if quick:
        return settings.DEMO_DATA_QUICK_GEN_PARAMS
    else:
        return settings.DEMO_DATA_GEN_PARAMS


def get_config_var(name, quick):
    config = get_config(quick)
    return config[name]


def get_data_file_path(file_name):
    return os.path.join(os.path.dirname(__file__), "data", file_name)


def get_event_from_file(file_name):
    file_path = get_data_file_path(file_name)
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


def gen_measurements(day):
    """
    Generate measurements that are random but distribution changs based on the day
    """
    return {
        "fp": {"value": random_normal(1250 - 50 * day, 200, 500)},
        "fcp": {"value": random_normal(1250 - 50 * day, 200, 500)},
        "lcp": {"value": random_normal(2800 - 50 * day, 400, 2000)},
        "fid": {"value": random_normal(5 - 0.125 * day, 2, 1)},
    }


@functools.lru_cache(maxsize=None)
def get_list_of_names() -> List[str]:
    file_path = get_data_file_path("names.json")
    with open(file_path) as f:
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


def generate_user(quick=False):
    NAME_STEP_SIZE = get_config_var("NAME_STEP_SIZE", quick)
    name_list = get_list_of_names()
    id_0_offset = random.randrange(0, len(name_list), NAME_STEP_SIZE)
    return get_user_by_id(id_0_offset)


def gen_random_author():
    author = "{} {}".format(random.choice(loremipsum.words), random.choice(loremipsum.words))
    return (
        author,
        "{}@example.com".format(author.replace(" ", ".")),
    )


def get_release_from_time(org_id, timestamp):
    """
    Returns the most release before a specific time
    """
    return (
        Release.objects.filter(organization_id=org_id, date_added__lte=timestamp)
        .order_by("-date_added")
        .first()
    )


def generate_commits(required_files, file_extensions):
    """
    Generate the JSON for commits that are a combination of randomly generated files
    And a set of files (required_files) with specific file extensions
    """
    commits = []
    for i in range(random.randint(len(required_files), 20)):
        if i < len(required_files):
            filename = required_files[i]
        else:
            # create a realistic file path based off the extension we choose
            extension = random.choice(file_extensions)
            base_path = random.choice(base_paths_by_file_type[extension])
            filename = base_path + random.choice(loremipsum.words) + "." + extension

        # TODO: pass in user list for commits
        author = gen_random_author()

        base_message = random.choice(commit_message_base_messages)

        commits.append(
            {
                "key": sha1(uuid4().bytes).hexdigest(),
                "message": f"{base_message} {filename}",
                "author": author,
                "files": [(filename, "M")],
            }
        )
    return commits


def generate_releases(projects, quick):
    config = get_config(quick)
    NUM_RELEASES = config["NUM_RELEASES"]
    MAX_DAYS = config["MAX_DAYS"]
    release_time = timezone.now() - timedelta(days=MAX_DAYS)
    hourly_release_cadence = MAX_DAYS * 24.0 / NUM_RELEASES
    org = projects[0].organization
    org_id = org.id
    for i in range(NUM_RELEASES):
        release = Release.objects.create(
            version=f"V{i + 1}",
            organization_id=org_id,
            date_added=release_time,
        )
        for project in projects:
            release.add_project(project)

        # TODO: unhardcode params when we add more scenarios
        raw_commits = generate_commits(["components/ShoppingCart.js", "flask/app.py"], ["js", "py"])

        repo, _ = Repository.objects.get_or_create(
            organization_id=org.id,
            external_id="example/example",
            defaults={
                "name": "Example Repo",
            },
        )
        authors = set()

        for commit_index, raw_commit in enumerate(raw_commits):
            author = CommitAuthor.objects.get_or_create(
                organization_id=org.id,
                email=raw_commit["author"][1],
                defaults={"name": raw_commit["author"][0]},
            )[0]
            commit = Commit.objects.get_or_create(
                organization_id=org.id,
                repository_id=repo.id,
                key=raw_commit["key"],
                defaults={
                    "author": author,
                    "message": raw_commit["message"],
                    "date_added": release_time,
                },
            )[0]
            authors.add(author)

            for file in raw_commit["files"]:
                ReleaseFile.objects.get_or_create(
                    organization_id=project.organization_id,
                    release=release,
                    name=file[0],
                    file=File.objects.get_or_create(
                        name=file[0], type="release.file", checksum="abcde" * 8, size=13043
                    )[0],
                    defaults={"organization_id": project.organization_id},
                )

                CommitFileChange.objects.get_or_create(
                    organization_id=org.id, commit=commit, filename=file[0], type=file[1]
                )

            ReleaseCommit.objects.get_or_create(
                organization_id=org.id, release=release, commit=commit, order=commit_index
            )

        release_time += timedelta(hours=hourly_release_cadence)


def safe_send_event(data, quick):
    project = data.pop("project")
    config = get_config(quick)
    try:
        create_sample_event_basic(data, project.id)
        time.sleep(config["DEFAULT_BACKOFF_TIME"])
    except SnubaError:
        # if snuba fails, just back off and continue
        logger.info("safe_send_event.snuba_error")
        time.sleep(config["ERROR_BACKOFF_TIME"])


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


def fix_error_event(event_json, quick=False):
    fix_timestamps(event_json)
    fix_breadrumbs(event_json, quick)


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


def fix_breadrumbs(event_json, quick):
    """
    Fixes the timestamps on breadcrumbs to match the current time
    Evenly spaces out all breadcrumbs starting at BREADCRUMB_LOOKBACK_TIME ago
    """
    BREADCRUMB_LOOKBACK_TIME = get_config_var("BREADCRUMB_LOOKBACK_TIME", quick)
    breadcrumbs = event_json.get("breadcrumbs", {}).get("values", [])
    num_breadcrumbs = len(breadcrumbs)
    breadcrumb_time_step = BREADCRUMB_LOOKBACK_TIME * 1.0 / num_breadcrumbs

    curr_time = event_json["timestamp"] - BREADCRUMB_LOOKBACK_TIME
    for breadcrumb in breadcrumbs:
        breadcrumb["timestamp"] = curr_time
        curr_time += breadcrumb_time_step


def iter_timestamps(disribution_fn_num: int, quick: bool):
    """
    Yields a series of ordered timestamps and the day in a tuple
    """

    # disribution_fn_num starts at 1 instead of 0
    distribution_fn = distrubtion_fns[disribution_fn_num - 1]

    config = get_config(quick)
    MAX_DAYS = config["MAX_DAYS"]
    SCALE_FACTOR = config["SCALE_FACTOR"]
    BASE_OFFSET = config["BASE_OFFSET"]

    start_time = timezone.now() - timedelta(days=MAX_DAYS)

    for day in range(MAX_DAYS):
        for hour in range(24):
            base = distribution_fn(hour)
            # determine the number of events we want in this hour
            num_events = int((BASE_OFFSET + SCALE_FACTOR * base) * random.uniform(0.6, 1.0))
            timestamps = []
            for i in range(num_events):

                # pick the minutes randomly
                minute = random.randint(0, 60)
                timestamp = start_time + timedelta(days=day, hours=hour, minutes=minute)
                timestamp = timestamp.replace(tzinfo=pytz.utc)
                timestamps.append(timestamp)

            # sort the timestamps so we send things in order
            timestamps.sort()

            for timestamp in timestamps:
                # yield the day since we use it as well
                yield (timestamp, day)


def populate_connected_event_scenario_1(
    react_project: Project, python_project: Project, quick=False
):
    """
    This function populates a set of four related events with the same trace id:
    - Front-end transaction
    - Front-end error
    - Back-end transaction
    - Back-end error
    Occurrance times and durations are randomized
    """
    react_transaction = get_event_from_file("scen1/react_transaction.json")
    react_error = get_event_from_file("scen1/react_error.json")
    python_transaction = get_event_from_file("scen1/python_transaction.json")
    python_error = get_event_from_file("scen1/python_error.json")

    log_extra = {
        "organization_slug": react_project.organization.slug,
        "quick": quick,
    }
    logger.info("populate_connected_event_scenario_1.start", extra=log_extra)

    for (timestamp, day) in iter_timestamps(1, quick):
        transaction_user = generate_user(quick)
        trace_id = uuid4().hex
        release = get_release_from_time(react_project.organization_id, timestamp)
        release_sha = release.version

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
            release=release_sha,
            timestamp=timestamp,
            # start_timestamp decreases based on day so that there's a trend
            start_timestamp=timestamp - timedelta(seconds=frontend_duration),
            measurements=gen_measurements(day),
            contexts=frontend_context,
        )

        fix_transaction_event(local_event, old_span_id)
        safe_send_event(local_event, quick)

        # note picking the 0th span is arbitrary
        backend_parent_id = local_event["spans"][0]["span_id"]

        # React error
        local_event = copy.deepcopy(react_error)
        local_event.update(
            project=react_project,
            platform=react_project.platform,
            timestamp=timestamp,
            user=transaction_user,
            release=release_sha,
            contexts=frontend_context,
        )
        fix_error_event(local_event, quick)
        safe_send_event(local_event, quick)

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
            release=release_sha,
            contexts=backend_context,
        )
        fix_transaction_event(local_event, old_span_id)
        safe_send_event(local_event, quick)

        # python error
        local_event = copy.deepcopy(python_error)
        local_event.update(
            project=python_project,
            platform=python_project.platform,
            timestamp=timestamp,
            user=transaction_user,
            release=release_sha,
            contexts=backend_context,
        )
        fix_error_event(local_event, quick)
        safe_send_event(local_event, quick)
    logger.info("populate_connected_event_scenario_1.finished", extra=log_extra)


def populate_connected_event_scenario_2(
    react_project: Project, python_project: Project, quick=False
):
    """
    This function populates a set of two related events with the same trace id:
    - Front-end transaction
    - Back-end transaction
    Occurrance times and durations are randomized
    """
    react_transaction = get_event_from_file("scen2/react_transaction.json")
    python_transaction = get_event_from_file("scen2/python_transaction.json")

    log_extra = {
        "organization_slug": react_project.organization.slug,
        "quick": quick,
    }
    logger.info("populate_connected_event_scenario_2.start", extra=log_extra)

    for (timestamp, day) in iter_timestamps(2, quick):
        transaction_user = generate_user(quick)
        trace_id = uuid4().hex
        release = get_release_from_time(react_project.organization_id, timestamp)
        release_sha = release.version

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
            release=release_sha,
            timestamp=timestamp,
            # start_timestamp decreases based on day so that there's a trend
            start_timestamp=timestamp - timedelta(seconds=frontend_duration),
            measurements=gen_measurements(day),
            contexts=frontend_context,
        )

        fix_transaction_event(local_event, old_span_id)
        safe_send_event(local_event, quick)

        # note picking the 0th span is arbitrary
        backend_parent_id = local_event["spans"][0]["span_id"]

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
            release=release_sha,
            contexts=backend_context,
        )
        fix_transaction_event(local_event, old_span_id)
        safe_send_event(local_event, quick)

    logger.info("populate_connected_event_scenario_2.finished", extra=log_extra)


def populate_connected_event_scenario_3(python_project: Project, quick=False):
    """
    This function populates a single Back-end error
    Occurrance times and durations are randomized
    """
    python_error = get_event_from_file("scen3/python_error.json")
    log_extra = {
        "organization_slug": python_project.organization.slug,
        "quick": quick,
    }
    logger.info("populate_connected_event_scenario_3.start", extra=log_extra)

    for (timestamp, day) in iter_timestamps(3, quick):
        transaction_user = generate_user(quick)
        trace_id = uuid4().hex
        release = get_release_from_time(python_project.organization_id, timestamp)
        release_sha = release.version

        backend_context = {
            "trace": {
                "type": "trace",
                "trace_id": trace_id,
                "span_id": uuid4().hex[:16],
            }
        }

        # python error
        local_event = copy.deepcopy(python_error)
        local_event.update(
            project=python_project,
            platform=python_project.platform,
            timestamp=timestamp,
            user=transaction_user,
            release=release_sha,
            contexts=backend_context,
        )
        fix_error_event(local_event, quick)
        safe_send_event(local_event, quick)
    logger.info("populate_connected_event_scenario_3.finished", extra=log_extra)


def handle_react_python_scenario(react_project: Project, python_project: Project, quick=False):
    """
    Handles all data population for the React + Python scenario
    """
    generate_releases([react_project, python_project], quick=quick)
    populate_connected_event_scenario_1(react_project, python_project, quick=quick)
    populate_connected_event_scenario_2(react_project, python_project, quick=quick)
    populate_connected_event_scenario_3(python_project, quick=quick)
