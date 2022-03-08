import os.path
import random
import time
from datetime import datetime, timedelta
from uuid import uuid4

import pytz

from sentry.constants import DATA_ROOT, INTEGRATION_ID_TO_PLATFORM_DATA
from sentry.event_manager import EventManager, set_tag
from sentry.interfaces.user import User as UserInterface
from sentry.spans.grouping.utils import hash_values
from sentry.utils import json
from sentry.utils.canonical import CanonicalKeyDict
from sentry.utils.dates import to_timestamp

epoch = datetime.utcfromtimestamp(0)


def random_normal(mu, sigma, minimum, maximum=None):
    random_value = max(random.normalvariate(mu, sigma), minimum)
    if maximum is not None:
        random_value = min(random_value, maximum)
    return random_value


def milliseconds_ago(now, milliseconds):
    ago = now - timedelta(milliseconds=milliseconds)
    return (ago - epoch).total_seconds()


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
    all_samples = {f for f in os.listdir(samples_root) if f.endswith(".json")}

    for platform in (platform, language, default):
        if not platform:
            continue

        # Verify by checking if the file is within our folder explicitly
        # avoids being able to have a name that invokes traversing directories.
        json_path = f"{platform}.json"

        if json_path not in all_samples:
            continue

        if not sample_name:
            try:
                sample_name = INTEGRATION_ID_TO_PLATFORM_DATA[platform]["name"]
            except KeyError:
                pass

        # XXX: At this point, it's assumed that `json_path` was safely found
        # within `samples_root` due to the check above and cannot traverse
        # into paths.
        with open(os.path.join(samples_root, json_path)) as fp:
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
    timestamp = timestamp.replace(tzinfo=pytz.utc)
    data.setdefault("timestamp", to_timestamp(timestamp))

    if data.get("type") == "transaction":
        if start_timestamp is None:
            start_timestamp = timestamp - timedelta(seconds=3)
        else:
            start_timestamp = start_timestamp.replace(tzinfo=pytz.utc)
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
                if key in ["fp", "fcp", "lcp", "fid"]:
                    measurement_markers[f"mark.{key}"] = {
                        "value": round(data["start_timestamp"] + entry["value"] / 1000, 3)
                    }
            measurements.update(measurement_markers)

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
        return
    for key in ["parent_span_id", "hash", "exclusive_time"]:
        if key in kwargs:
            data["contexts"]["trace"][key] = kwargs.pop(key)

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
    for _ in range(data.get("errors", 0)):
        create_sample_event(
            project=data["project"],
            platform="javascript" if frontend else "python",
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
    create_sample_event(
        project=data["project"],
        platform="javascript-transaction" if frontend else "transaction",
        transaction=data["transaction"],
        event_id=uuid4().hex,
        user=user,
        timestamp=timestamp,
        start_timestamp=start_timestamp,
        measurements={
            "fp": {"value": random_normal(1250 - 50, 200, 500)},
            "fcp": {"value": random_normal(1250 - 50, 200, 500)},
            "lcp": {"value": random_normal(2800 - 50, 400, 2000)},
            "fid": {"value": random_normal(5 - 0.125, 2, 1)},
        }
        if frontend
        else {},
        # Root
        parent_span_id=parent_span_id,
        span_id=current_span_id,
        trace=trace_id,
        spans=spans,
        hash=hash_values([data["transaction"]]),
        # not the best but just set the exclusive time
        # equal to the duration to get some span data
        exclusive_time=(timestamp - start_timestamp).total_seconds(),
    )
    # try to give clickhouse some breathing room
    if slow:
        time.sleep(0.05)
