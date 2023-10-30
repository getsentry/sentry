import logging
import os.path
import random
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from django.core.exceptions import SuspiciousFileOperation

from sentry.constants import DATA_ROOT, INTEGRATION_ID_TO_PLATFORM_DATA
from sentry.event_manager import EventManager, set_tag
from sentry.interfaces.user import User as UserInterface
from sentry.spans.grouping.utils import hash_values
from sentry.utils import json
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.dates import to_timestamp

logger = logging.getLogger(__name__)
epoch = datetime.utcfromtimestamp(0)


def random_normal(mu, sigma, minimum, maximum=None):
    random_value = max(random.normalvariate(mu, sigma), minimum)
    if maximum is not None:
        random_value = min(random_value, maximum)
    return random_value


def random_ip():
    not_valid = [10, 127, 169, 172, 192]

    first = random.randrange(1, 256)
    while first in not_valid:
        first = random.randrange(1, 256)

    return ".".join(
        (
            str(first),
            str(random.randrange(1, 256)),
            str(random.randrange(1, 256)),
            str(random.randrange(1, 256)),
        )
    )


def random_geo():
    return random.choice(
        [
            {"country_code": "US", "region": "CA", "city": "San Francisco"},
            {"country_code": "AU", "region": "VIC", "city": "Melbourne"},
            {"country_code": "GB", "region": "H9", "city": "London"},
        ]
    )


def random_username():
    return random.choice(
        [
            "jess",
            "david",
            "chris",
            "eric",
            "katie",
            "ben",
            "armin",
            "saloni",
            "max",
            "meredith",
            "matt",
            "sentry",
        ]
    )


def name_for_username(username):
    return {
        "ben": "Ben Vinegar",
        "chris": "Chris Jennings",
        "david": "David Cramer",
        "matt": "Matt Robenolt",
        "jess": "Jess MacQueen",
        "katie": "Katie Lundsgaard",
        "saloni": "Saloni Dudziak",
        "max": "Max Bittker",
        "meredith": "Meredith Heller",
        "eric": "Eric Feng",
        "armin": "Armin Ronacher",
    }.get(username, username.replace("_", " ").title())


def generate_user(username=None, email=None, ip_address=None, id=None):
    if username is None and email is None:
        username = random_username()
        email = f"{username}@example.com"
    return UserInterface.to_python(
        {
            "id": id,
            "username": username,
            "email": email,
            "ip_address": ip_address or random_ip(),
            "name": name_for_username(username),
            "geo": random_geo(),
        }
    ).to_json()


def load_data(
    platform,
    default=None,
    sample_name=None,
    timestamp=None,
    start_timestamp=None,
    trace=None,
    span_id=None,
    spans=None,
    trace_context=None,
    fingerprint=None,
    event_id=None,
):
    # NOTE: Before editing this data, make sure you understand the context
    # in which its being used. It is NOT only used for local development and
    # has production consequences.
    #   * bin/load-mocks to generate fake data for local testing
    #   * When a new project is created, a fake event is generated as a "starter"
    #     event so it's not an empty project.
    #   * When a user clicks Test Configuration from notification plugin settings page,
    #     a fake event is generated to go through the pipeline.
    data = None
    language = None
    platform_data = INTEGRATION_ID_TO_PLATFORM_DATA.get(platform)

    if platform_data is not None and platform_data["type"] != "language":
        language = platform_data["language"]

    samples_root = os.path.join(DATA_ROOT, "samples")

    # this loop will try to load the specified platform first, but if we do not
    # have a specific sample for it, we then move on to the `language`, then the `default`.
    # The `default` is set to `javascript` in ./src/sentry/api/endpoints/project_create_sample.py
    # on the `ProjectCreateSampleEndpoint`
    for sample in (platform, language, default):
        if not sample:
            continue

        # Verify the requested path is valid and disallow path traversal attempts
        json_file = f"{sample}.json"

        expected_commonpath = os.path.realpath(
            samples_root
        )  # .realpath() ensures symlinks are handled
        json_path = os.path.join(samples_root, json_file)
        json_real_path = os.path.realpath(json_path)

        if expected_commonpath != os.path.commonpath([expected_commonpath, json_real_path]):
            raise SuspiciousFileOperation("potential path traversal attack detected")

        # the requested `sample` does not exist, so continue through to the next iteration
        if not os.path.exists(json_path):
            continue

        if not os.path.isfile(json_path):
            raise IsADirectoryError("expected file but found a directory instead")

        if not sample_name:
            try:
                sample_name = INTEGRATION_ID_TO_PLATFORM_DATA[platform]["name"]
            except KeyError:
                pass

        # XXX: At this point, it's assumed that `json_path` was safely found
        # within `samples_root` due to the checks above and cannot traverse
        # into paths.
        with open(json_path) as fp:
            data = json.load(fp)
            break

    if data is None:
        return

    data = CanonicalKeyDict(data)
    if platform in ("csp", "hkpk", "expectct", "expectstaple"):
        return data

    # Generate a timestamp in the present.
    if timestamp is None:
        timestamp = datetime.utcnow() - timedelta(minutes=1)
        timestamp = timestamp - timedelta(microseconds=timestamp.microsecond % 1000)
    timestamp = timestamp.replace(tzinfo=timezone.utc)
    data.setdefault("timestamp", to_timestamp(timestamp))

    if data.get("type") == "transaction":
        if start_timestamp is None:
            start_timestamp = timestamp - timedelta(seconds=3)
        else:
            start_timestamp = start_timestamp.replace(tzinfo=timezone.utc)
        data["start_timestamp"] = to_timestamp(start_timestamp)

        if trace is None:
            trace = uuid4().hex
        if span_id is None:
            span_id = uuid4().hex[:16]

        for tag in data["tags"]:
            if tag[0] == "trace":
                tag[1] = trace
            elif tag[0] == "trace.span":
                tag[1] = span_id
        data["contexts"]["trace"]["trace_id"] = trace
        data["contexts"]["trace"]["span_id"] = span_id
        if trace_context is not None:
            data["contexts"]["trace"].update(trace_context)
        if spans:
            data["spans"] = spans

        for span in data.get("spans", []):
            # Use data to generate span timestamps consistently and based
            # on event timestamp
            duration = span.get("data", {}).get("duration", 10.0)
            offset = span.get("data", {}).get("offset", 0)

            # Span doesn't have a parent, make it the transaction
            if span.get("parent_span_id") is None:
                span["parent_span_id"] = span_id
            if span.get("span_id") is None:
                span["span_id"] = uuid4().hex[:16]

            span_start = data["start_timestamp"] + offset
            span["trace_id"] = trace
            span.setdefault("start_timestamp", span_start)
            span.setdefault("timestamp", span_start + duration)

        measurements = data.get("measurements")

        if measurements:
            measurement_markers = {}
            for key, entry in measurements.items():
                if key in [
                    "fp",
                    "fcp",
                    "lcp",
                    "fid",
                    "time_to_initial_display",
                    "time_to_full_display",
                ]:
                    measurement_markers[f"mark.{key}"] = {
                        "unit": "none",
                        "value": round(data["start_timestamp"] + entry["value"] / 1000, 3),
                    }
            measurements.update(measurement_markers)

        if fingerprint is not None:
            for f in fingerprint:
                f_data = f.split("-", 1)
                if len(f_data) < 2:
                    raise ValueError(
                        "Invalid performance fingerprint data. Format must be 'group_type-fingerprint'."
                    )

            data["fingerprint"] = fingerprint

    if event_id is not None:
        data["event_id"] = event_id

    data["platform"] = platform
    # XXX: Message is a legacy alias for logentry. Do not overwrite if set.
    if "message" not in data:
        data["message"] = f"This is an example {sample_name or platform} exception"
    data.setdefault(
        "user",
        generate_user(ip_address="127.0.0.1", username="sentry", id=1, email="sentry@example.com"),
    )
    data.setdefault(
        "extra",
        {
            "session": {"foo": "bar"},
            "results": [1, 2, 3, 4, 5],
            "emptyList": [],
            "emptyMap": {},
            "length": 10837790,
            "unauthorized": False,
            "url": "http://example.org/foo/bar/",
        },
    )
    data.setdefault("modules", {"my.package": "1.0.0"})
    data.setdefault(
        "request",
        {
            "cookies": "foo=bar;biz=baz",
            "url": "http://example.com/foo",
            "headers": {
                "Referer": "http://example.com",
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 6.2; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.72 Safari/537.36",
            },
            "env": {"ENV": "prod"},
            "query_string": "foo=bar",
            "data": '{"hello": "world"}',
            "method": "GET",
        },
    )

    return data


def create_n_plus_one_issue(data):
    timestamp = datetime.fromtimestamp(data["start_timestamp"])
    n_plus_one_db_duration = timedelta(milliseconds=100)
    n_plus_one_db_current_offset = timestamp
    parent_span_id = data["spans"][0]["parent_span_id"]
    trace_id = data["contexts"]["trace"]["trace_id"]
    data["spans"].append(
        {
            "timestamp": (timestamp + n_plus_one_db_duration).timestamp(),
            "start_timestamp": (timestamp + timedelta(milliseconds=10)).timestamp(),
            "description": "SELECT `books_book`.`id`, `books_book`.`title`, `books_book`.`author_id` FROM `books_book` ORDER BY `books_book`.`id` DESC LIMIT 10",
            "op": "db",
            "parent_span_id": parent_span_id,
            "span_id": uuid4().hex[:16],
            "hash": "858fea692d4d93e8",
            "trace_id": trace_id,
        }
    )
    for i in range(200):
        n_plus_one_db_duration += timedelta(milliseconds=200) + timedelta(milliseconds=1)
        n_plus_one_db_current_offset = timestamp + n_plus_one_db_duration
        data["spans"].append(
            {
                "timestamp": (
                    n_plus_one_db_current_offset + timedelta(milliseconds=200)
                ).timestamp(),
                "start_timestamp": (
                    n_plus_one_db_current_offset + timedelta(milliseconds=1)
                ).timestamp(),
                "description": "SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21",
                "op": "db",
                "span_id": uuid4().hex[:16],
                "parent_span_id": parent_span_id,
                "hash": "63f1e89e6a073441",
                "trace_id": trace_id,
            }
        )
    data["spans"].append(
        {
            "timestamp": (
                timestamp + n_plus_one_db_duration + timedelta(milliseconds=200)
            ).timestamp(),
            "start_timestamp": timestamp.timestamp(),
            "description": "new",
            "op": "django.view",
            "parent_span_id": uuid4().hex[:16],
            "span_id": parent_span_id,
            "hash": "0f43fb6f6e01ca52",
            "trace_id": trace_id,
        }
    )


def create_db_main_thread_issue(data):
    timestamp = datetime.fromtimestamp(data["start_timestamp"])
    span_duration = timedelta(milliseconds=100)
    parent_span_id = data["spans"][0]["parent_span_id"]
    trace_id = data["contexts"]["trace"]["trace_id"]
    data["spans"].append(
        {
            "timestamp": (timestamp + span_duration).timestamp(),
            "start_timestamp": (timestamp + timedelta(milliseconds=10)).timestamp(),
            "description": "SELECT `books_book`.`id`, `books_book`.`title`, `books_book`.`author_id` FROM `books_book` ORDER BY `books_book`.`id` DESC LIMIT 10",
            "op": "db",
            "parent_span_id": parent_span_id,
            "span_id": uuid4().hex[:16],
            "hash": "858fea692d4d93e8",
            "trace_id": trace_id,
            "data": {"blocked_main_thread": True},
        }
    )


PERFORMANCE_ISSUE_CREATORS = {
    "n+1": create_n_plus_one_issue,
    "db-main-thread": create_db_main_thread_issue,
}


def create_sample_event(
    project,
    platform=None,
    default=None,
    raw=True,
    sample_name=None,
    timestamp=None,
    start_timestamp=None,
    trace=None,
    span_id=None,
    spans=None,
    tagged=False,
    performance_issues=None,
    **kwargs,
):
    if not platform and not default:
        return

    data = load_data(
        platform,
        default,
        sample_name,
        timestamp,
        start_timestamp,
        trace,
        span_id,
        spans,
    )

    if not data:
        logger.info(
            "create_sample_event: no data loaded",
            extra={
                "project_id": project.id,
                "sample_event": True,
            },
        )
        return
    for key in ["parent_span_id", "hash", "exclusive_time"]:
        if key in kwargs:
            data["contexts"]["trace"][key] = kwargs.pop(key)
    if performance_issues:
        for issue in performance_issues:
            if issue in PERFORMANCE_ISSUE_CREATORS:
                PERFORMANCE_ISSUE_CREATORS[issue](data)

    data.update(kwargs)
    return create_sample_event_basic(data, project.id, raw=raw, tagged=tagged)


def create_sample_event_basic(
    data, project_id, raw=True, skip_send_first_transaction=False, tagged=False
):
    if tagged:
        set_tag(data, "sample_event", "yes")
    manager = EventManager(data)
    manager.normalize()
    return manager.save(
        project_id, raw=raw, skip_send_first_transaction=skip_send_first_transaction
    )


def create_trace(slow, start_timestamp, timestamp, user, trace_id, parent_span_id, data):
    """A recursive function that creates the events of a trace"""
    frontend = data.get("frontend")
    mobile = data.get("mobile")

    current_span_id = uuid4().hex[:16]
    spans = []
    new_start = start_timestamp + timedelta(milliseconds=random_normal(50, 25, 10))
    new_end = timestamp - timedelta(milliseconds=random_normal(50, 25, 10))

    for child in data["children"]:
        span_id = uuid4().hex[:16]
        description = f"GET {child['transaction']}"
        duration = random_normal((new_end - new_start).total_seconds(), 0.25, 0.01)
        spans.append(
            {
                "same_process_as_parent": True,
                "op": "http",
                "description": description,
                "data": {
                    "duration": duration,
                    "offset": 0.02,
                },
                "span_id": span_id,
                "trace_id": trace_id,
                "hash": hash_values([description]),
                # not the best but just set the exclusive time
                # equal to the duration to get some span data
                "exclusive_time": duration,
            }
        )
        create_trace(
            slow,
            start_timestamp + timedelta(milliseconds=random_normal(50, 25, 10)),
            timestamp - timedelta(milliseconds=random_normal(50, 25, 10)),
            user,
            trace_id,
            span_id,
            child,
        )

    if frontend:
        platform = "javascript"
    elif mobile:
        platform = "android"
    else:
        platform = "python"

    for _ in range(data.get("errors", 0)):
        create_sample_event(
            project=data["project"],
            platform=platform,
            user=user,
            transaction=data["transaction"],
            contexts={
                "trace": {
                    "type": "trace",
                    "trace_id": trace_id,
                    "span_id": random.choice(spans + [{"span_id": current_span_id}])["span_id"],
                }
            },
        )

    if frontend:
        txn_platform = "javascript-transaction"
        measurements = {
            "fp": {"value": random_normal(1250 - 50, 200, 500)},
            "fcp": {"value": random_normal(1250 - 50, 200, 500)},
            "lcp": {"value": random_normal(2800 - 50, 400, 2000)},
            "fid": {"value": random_normal(5 - 0.125, 2, 1)},
        }
    elif mobile:
        txn_platform = "android-transaction"
        measurements = {
            "time_to_initial_display": {"value": random_normal(2200 - 50, 400, 2000)},
            "time_to_full_display": {"value": random_normal(3500 - 50, 400, 2000)},
        }
    else:
        txn_platform = "transaction"
        measurements = {}
    create_sample_event(
        project=data["project"],
        platform=txn_platform,
        transaction=data["transaction"],
        event_id=uuid4().hex,
        user=user,
        timestamp=timestamp,
        start_timestamp=start_timestamp,
        measurements=measurements,
        # Root
        parent_span_id=parent_span_id,
        span_id=current_span_id,
        trace=trace_id,
        spans=spans,
        hash=hash_values([data["transaction"]]),
        performance_issues=data.get("performance_issues"),
        # not the best but just set the exclusive time
        # equal to the duration to get some span data
        exclusive_time=(timestamp - start_timestamp).total_seconds(),
    )
    # try to give clickhouse some breathing room
    if slow:
        time.sleep(0.05)
