import copy
import functools
import logging
import os
import random
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from functools import wraps
from hashlib import sha1
from typing import List
from uuid import uuid4

import pytz
import requests
import sentry_sdk
from django.conf import settings
from django.utils import timezone

from sentry.api.utils import get_date_range_from_params
from sentry.discover.endpoints.serializers import DiscoverSavedQuerySerializer
from sentry.discover.models import DiscoverSavedQuery
from sentry.incidents.logic import (
    create_alert_rule,
    create_alert_rule_trigger,
    create_alert_rule_trigger_action,
    create_incident,
    update_incident_status,
)
from sentry.incidents.models import (
    AlertRuleThresholdType,
    AlertRuleTriggerAction,
    IncidentActivity,
    IncidentActivityType,
    IncidentStatus,
    IncidentType,
)
from sentry.interfaces.user import User as UserInterface
from sentry.mediators import project_rules
from sentry.models import (
    Commit,
    CommitAuthor,
    CommitFileChange,
    File,
    Group,
    GroupAssignee,
    GroupStatus,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectKey,
    Release,
    ReleaseCommit,
    ReleaseFile,
    Repository,
    SavedSearch,
    Team,
    User,
)
from sentry.models.groupinbox import GroupInboxReason, add_group_to_inbox
from sentry.utils import json, loremipsum
from sentry.utils.dates import to_timestamp
from sentry.utils.email import create_fake_email
from sentry.utils.samples import create_sample_event_basic, random_geo, random_ip, random_normal
from sentry.utils.snuba import SnubaError

release_prefix = "checkout-app"

user_email_domain = "example.com"

commit_message_base_messages = [
    "feat: Do something to",
    "feat: Update code in",
    "ref: Refactor code in",
    "fix: Fix bug in",
]

base_paths_by_file_type = {"js": ["components/", "views/"], "py": ["flask/", "routes/"]}

rate_by_release_num = [0.8, 0.85, 0.75]
agg_rate_by_release_num = [0.99, 0.999, 0.95]

org_users = [
    ("scefali", "Stephen Cefali"),
    ("aj", "AJ Jindal"),
    ("zac.propersi", "Zac Propersi"),
    ("roggenkemper", "Richard Roggenkemper"),
    ("neozhang", "Neo Zhang"),
]

logger = logging.getLogger(__name__)

contexts_by_mobile_platform = {
    "apple-ios": {
        "device": [
            ["iPad13,1", "iOS"],
            ["iPad13,2", "iOS"],
            ["iPhone13,1", "iOS"],
            ["iPhone11", "iOS"],
        ],
        "os": [["iOS", "14.5"], ["iOS", "13.3"], ["iOS", "14.6"], ["iOS", "12"]],
    },
    "android": {
        "device": [
            ["Pixel 4", "Pixel"],
            ["Pixel 5", "Pixel"],
            ["Pixel 3a", "Pixel"],
            ["SM-A125U", "SM-A125U"],
            ["SM-G973U", "SM-G973U"],
        ],
        "os": [["Android", "10"], ["Android", "9"], ["Android", "8"]],
    },
}

saved_search_by_platform = {
    "global": [
        ["Unhandled Errors", "is:unresolved error.unhandled:true"],
        ["Release 3.2 Errors", "release:checkout-app@3.2"],
    ],
    "python": [
        ["Firefox Errors - Python", "browser.name:Firefox"],
    ],
    "apple-ios": [["iOS 12 Errors", 'os:"iOS 12"']],
    "javascript-react": [],
    "android": [],
    "react-native": [],
}

mobile_platforms = ["apple-ios", "android", "react-native"]

alert_platforms = ["android", "python"]


def get_data_file_path(file_name):
    return os.path.join(os.path.dirname(__file__), "data", file_name)


def get_event_from_file(file_name):
    file_path = get_data_file_path(file_name)
    with open(file_path) as f:
        return clean_event(json.load(f))


def distribution_v1(hour: int) -> int:
    if hour > 9 and hour < 12:
        return 9
    if hour > 6 and hour < 15:
        return 4
    if hour > 4 and hour < 20:
        return 3
    return 2


def distribution_v2(hour: int) -> int:
    if hour > 18 and hour < 20:
        return 12
    if hour > 9 and hour < 14:
        return 8
    if hour > 3 and hour < 22:
        return 5
    return 4


def distribution_v3(hour: int) -> int:
    if hour == 17:
        return 36
    if hour > 21:
        return 14
    if hour > 6 and hour < 15:
        return 9
    if hour > 3:
        return 5
    return 3


def distribution_v4(hour: int) -> int:

    if hour > 13 and hour < 20:
        return 13
    if hour > 5 and hour < 12:
        return 8
    if hour > 3 and hour < 22:
        return 5
    return 3


def distribution_v5(hour: int) -> int:
    if hour == 3:
        return 49
    if hour < 5:
        return 9
    if hour > 18 and hour < 21:
        return 14
    return 3


def distribution_v6(hour: int) -> int:
    if hour == 20:
        return 17
    if hour > 17 and hour < 21:
        return 13
    if hour > 6 and hour < 11:
        return 8
    if hour == 3:
        return 20
    return 9


def distribution_v7(hour: int) -> int:
    if hour == 3:
        return 9
    if hour < 8:
        return 6
    if hour > 9 and hour < 12:
        return 11
    if hour > 18:
        return 12
    return 7


def distribution_v8(hour: int) -> int:
    if hour > 6 and hour < 10:
        return 12
    if hour < 3:
        return 9
    if hour > 16 and hour < 19:
        return 14
    if hour == 23:
        return 17
    return 7


def distribution_v9(hour: int) -> int:
    if hour < 4:
        return 16
    if hour > 4 and hour < 7:
        return 12
    if hour == 16:
        return 17
    if hour == 19:
        return 16
    return 9


def distribution_v10(hour: int) -> int:
    if hour > 12 and hour < 17:
        return 12
    if hour > 7 and hour < 10:
        return 14
    if hour == 3:
        return 19
    if hour == 21:
        return 17
    return 7


distribution_fns = [
    distribution_v1,
    distribution_v2,
    distribution_v3,
    distribution_v4,
    distribution_v5,
    distribution_v6,
    distribution_v7,
    distribution_v8,
    distribution_v9,
    distribution_v10,
]


def gen_measurements(full_duration):
    duration_ms = full_duration * 1000.0
    """
    Generate measurements that are random but based on the full duration
    """
    return {
        "fp": {"value": duration_ms * random.uniform(0.8, 0.95)},
        "fcp": {"value": duration_ms * random.uniform(0.8, 0.95)},
        "lcp": {"value": duration_ms * random.uniform(1.05, 1.2)},
        "fid": {"value": random_normal(5, 2, 1)},
    }


@functools.lru_cache(maxsize=None)
def get_list_of_names() -> List[str]:
    file_path = get_data_file_path("names.json")
    with open(file_path) as f:
        return json.load(f)


@functools.lru_cache(maxsize=None)
def get_list_of_base_contexts():
    file_path = get_data_file_path("contexts.json")
    with open(file_path) as f:
        return json.load(f)


# create a cache by user id so we can can consistent
# ip addresses and geos for a user
@functools.lru_cache(maxsize=10 * 1000)
def get_user_by_id(id_0_offset):
    name_list = get_list_of_names()
    name = name_list[id_0_offset]
    email = f"{name.lower()}@{user_email_domain}"
    return UserInterface.to_python(
        {
            "id": id_0_offset + 1,
            "email": email,
            "ip_address": random_ip(),
            "name": name,
            "geo": random_geo(),
        }
    ).to_json()


def gen_random_author():
    (email_base, name) = random.choice(org_users)
    email = create_fake_email(email_base, "demo")
    return (name, email)


def gen_base_context():
    """
    Generates a base context from pure randomness
    """
    contexts = get_list_of_base_contexts()
    return random.choice(contexts)


def gen_mobile_context(platform):
    """
    Generates context for mobile events
    """
    if platform == "react-native":
        platform = random.choice(["apple-ios", "android"])
    contexts = contexts_by_mobile_platform[platform]
    device = random.choice(contexts["device"])
    os = random.choice(contexts["os"])
    context = {
        "device": {"model": device[0], "family": device[1], "type": "device"},
        "os": {"name": os[0], "version": os[1], "type": "os"},
    }
    return context


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


def catch_and_log_errors(func):
    """
    Catches any errors, log them, and wait before continuing
    """

    @wraps(func)
    def wrapped(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"{func.__name__}.error", extra={"error": str(e)}, exc_info=True)
            time.sleep(settings.DEMO_DATA_GEN_PARAMS["ERROR_BACKOFF_TIME"])

    return wrapped


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
        "tags",
        "sdk",
    ]
    for field in fields_to_delete:
        if field in event_json:
            del event_json[field]

    span_fields_to_delete = ["timestamp", "start_timestamp"]
    for field in span_fields_to_delete:
        for span in event_json.get("spans", []):
            if field in span:
                del span[field]

    # delete request header since they have data that won't match
    # the generated data
    request = event_json.get("request")
    if request and "headers" in request:
        del request["headers"]

    return event_json


def fix_spans(event_json, old_span_id):
    """
    This function does the following:
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

                # generate a new id and set the replacement mapping
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
                # the max duration should give some breathing room to the remaining spans
                max_duration = remaining_time - (avg_span_length / 4.0) * (last_index - i)
                # pick a random length for the span that's at most 2x the average span length
                duration = min(max_duration, random.uniform(0, 2 * avg_span_length))
            span["data"]["duration"] = duration
            span["start_timestamp"] = event_json["start_timestamp"] + span_offset
            span.setdefault("timestamp", span["start_timestamp"] + duration)
            # calculate the next span offset
            span_offset = duration + span_offset
            id_list.append(span["span_id"])


def fix_measurements(event_json):
    """Convert measurement data from durations into timestamps."""
    measurements = event_json.get("measurements")

    if measurements:
        measurement_markers = {}
        for key, entry in measurements.items():
            if key in ["fp", "fcp", "lcp", "fid"]:
                measurement_markers[f"mark.{key}"] = {
                    "value": round(event_json["start_timestamp"] + entry["value"] / 1000, 3)
                }
        measurements.update(measurement_markers)


def update_context(event, trace=None, platform=None):
    mobile = platform in mobile_platforms
    context = event["contexts"]
    # delete device since we aren't mocking it (yet)
    if "device" in context:
        del context["device"]
    # generate random browser and os
    base_context = gen_mobile_context(platform) if mobile else gen_base_context()
    context.update(**base_context)

    # add our trace info
    base_trace = context.get("trace", {})
    if not trace:
        trace = {"trace_id": uuid4().hex, "span_id": uuid4().hex[:16]}
    base_trace.update(**trace)
    context["trace"] = base_trace


def populate_org_members(org, team):
    for user_info in org_users:
        (email_base, name) = user_info
        email = create_fake_email(email_base, "demo")
        user, _ = User.objects.get_or_create(name=name, email=email, is_managed=True)
        member = OrganizationMember.objects.create(user=user, organization=org, role="member")
        OrganizationMemberTeam.objects.create(team=team, organizationmember=member, is_active=True)


def generate_incident_times(timestamps, time_interval, max_days):

    # sort time stamps and set up deque
    timestamps.sort()
    time_event_pairs = deque()

    # add timestamp to deque
    def add(timestamp):
        if len(time_event_pairs) and time_event_pairs[-1][0] == timestamp:
            time_event_pairs[-1][1] += 1
        else:
            time_event_pairs.append([timestamp, 1])
            if len(time_event_pairs) > time_interval:
                time_event_pairs.popleft()

    # count hits within last time_interval
    def count(timestamp):
        start_interval = timestamp - timedelta(minutes=time_interval)
        sum_window = sum(pair[1] for pair in time_event_pairs if pair[0] >= start_interval)
        return timestamp, sum_window

    # for each timestamp, add it, then count at that timestamp
    counts = []
    for timestamp in timestamps:
        add(timestamp)
        counts.append(count(timestamp))

    # find maximum number of events over intervals
    num_events = [count[1] for count in counts]
    critical = max(num_events + [0])

    # keeps track of adjacent time intervals where number of events is above threshold
    adjacent_groups = []
    # current group of adjacent intervals as for loop is iterated through
    current_group = []

    # find adjacent intervals where errors above critical
    for pair in sorted(counts):
        if pair[1] < critical:
            # ignore times where no alert is created
            counts.remove(pair)
        else:
            if not current_group:
                current_group = [pair]
            else:
                if pair[0] - timedelta(minutes=time_interval) < current_group[-1][0]:
                    current_group.append(pair)
                else:
                    adjacent_groups.append(current_group)
                    current_group = [pair]

    # adds final group if exists
    if current_group:
        adjacent_groups.append(current_group)

    times = []
    # combine adjacent intervals
    for adjacent_group in adjacent_groups:
        # start time is the beginning of the interval
        interval_time = adjacent_group.pop(0)[0]
        start_time = interval_time - timedelta(minutes=time_interval)
        # default end time if non adjacent is right after its interval
        end_time = interval_time
        for pair in adjacent_group:
            # delete combined interval
            end_time = pair[0]
            counts.remove(pair)

        times.append((start_time, end_time))

    return critical, times


class DataPopulation:
    """
    This class is used to populate data for a single organization
    """

    def __init__(self, org: Organization, quick: bool):
        self.org = org
        self.quick = quick
        self.timestamps_by_project = defaultdict(list)

    def get_config(self):
        """
        Returns the data generation config
        Depends on if we are doing a quick-gen or not
        """
        if self.quick:
            return settings.DEMO_DATA_QUICK_GEN_PARAMS
        else:
            return settings.DEMO_DATA_GEN_PARAMS

    def get_config_var(self, name):
        if self.quick:
            if name in self.get_config():
                return self.get_config()[name]
            else:
                return settings.DEMO_DATA_GEN_PARAMS[name]
        else:
            return self.get_config()[name]

    def log_info(self, message):
        log_context = {
            "organization_slug": self.org.slug,
            "quick": self.quick,
        }
        logger.info(message, extra=log_context)

    def generate_user(self):
        NAME_STEP_SIZE = self.get_config_var("NAME_STEP_SIZE")
        name_list = get_list_of_names()
        id_0_offset = random.randrange(0, len(name_list), NAME_STEP_SIZE)
        return get_user_by_id(id_0_offset)

    def gen_frontend_duration(self, day):
        """
        Generates the length of the front-end transaction based on our config,
        the day, and some randomness
        """

        DAY_DURATION_IMPACT = self.get_config_var("DAY_DURATION_IMPACT")
        MAX_DAYS = self.get_config_var("MAX_DAYS")
        MIN_FRONTEND_DURATION = self.get_config_var("MIN_FRONTEND_DURATION")
        day_weight = DAY_DURATION_IMPACT * day / MAX_DAYS

        alpha = self.get_config_var("DURATION_ALPHA")
        beta = self.get_config_var("DURATION_BETA")
        return MIN_FRONTEND_DURATION / 1000.0 + random.gammavariate(alpha, beta) / (1 + day_weight)

    def fix_breadcrumbs(self, event_json):
        """
        Fixes the timestamps on breadcrumbs to match the current time
        Evenly spaces out all breadcrumbs starting at BREADCRUMB_LOOKBACK_TIME ago
        """
        BREADCRUMB_LOOKBACK_TIME = self.get_config_var("BREADCRUMB_LOOKBACK_TIME")
        breadcrumbs = event_json.get("breadcrumbs", {}).get("values", [])
        num_breadcrumbs = len(breadcrumbs)
        if num_breadcrumbs == 0:
            return

        breadcrumb_time_step = BREADCRUMB_LOOKBACK_TIME * 1.0 / num_breadcrumbs

        curr_time = event_json["timestamp"] - BREADCRUMB_LOOKBACK_TIME
        for breadcrumb in breadcrumbs:
            breadcrumb["timestamp"] = curr_time
            curr_time += breadcrumb_time_step

    def fix_timestamps(self, event_json):
        """
        Convert a time zone aware datetime timestamps to a POSIX timestamp
        for an event.
        """
        event_json["timestamp"] = to_timestamp(event_json["timestamp"])
        start_timestamp = event_json.get("start_timestamp")
        if start_timestamp:
            event_json["start_timestamp"] = to_timestamp(start_timestamp)

    def fix_error_event(self, event_json):
        self.fix_timestamps(event_json)
        self.fix_breadcrumbs(event_json)

    def fix_transaction_event(self, event_json, old_span_id):
        self.fix_timestamps(event_json)
        fix_spans(event_json, old_span_id)
        fix_measurements(event_json)

    def safe_send_event(self, data):
        project = data.pop("project")
        try:
            create_sample_event_basic(data, project.id)
            time.sleep(self.get_config_var("DEFAULT_BACKOFF_TIME"))

            if project.slug in alert_platforms and data["type"] == "error":
                self.timestamps_by_project[project.slug].append(
                    datetime.fromtimestamp(data["timestamp"]).replace(tzinfo=pytz.utc)
                )

        except SnubaError:
            # if snuba fails, just back off and continue
            self.log_info("safe_send_event.snuba_error")
            time.sleep(self.get_config_var("ERROR_BACKOFF_TIME"))

    def generate_releases(self, projects):
        NUM_RELEASES = self.get_config_var("NUM_RELEASES")
        MAX_DAYS = self.get_config_var("MAX_DAYS")
        release_time = timezone.now() - timedelta(days=MAX_DAYS)
        hourly_release_cadence = MAX_DAYS * 24.0 / NUM_RELEASES
        org = projects[0].organization
        org_id = org.id
        for i in range(NUM_RELEASES):
            release = Release.objects.create(
                version=f"{release_prefix}@3.{i}",
                organization_id=org_id,
                date_added=release_time,
            )
            for project in projects:
                release.add_project(project)

            # TODO: unhardcode params when we add more scenarios
            raw_commits = generate_commits(
                [
                    "components/ShoppingCart.js",
                    "components/Form.js",
                    "flask/app.py",
                    "purchase.py",
                    "checkout.swift",
                    "shop.java",
                ],
                ["js", "py"],
            )

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
                        release_id=release.id,
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
                release.update(commit_count=release.commit_count + 1)

            release_time += timedelta(hours=hourly_release_cadence)

    def generate_alerts(self, project):
        self.generate_metric_alert(project)
        self.generate_issue_alert(project)

    def generate_metric_alert(self, project):
        org = project.organization
        team = Team.objects.filter(organization=org).first()
        time_interval = self.get_config_var("METRIC_ALERT_INTERVAL")
        max_days = self.get_config_var("MAX_DAYS")
        alert_rule = create_alert_rule(
            org,
            [project],
            f"High Error Rate - {project.name} ",
            "level:error",
            "count()",
            time_interval,
            AlertRuleThresholdType.ABOVE,
            1,
        )

        # date_modified is changed by max_days times 2 to make sure
        # the grey modified alert will always be off the chart and not visible
        alert_rule.update(
            date_added=timezone.now() - timedelta(days=max_days),
            date_modified=timezone.now() - timedelta(days=max_days * 2),
        )

        # find the times when alerts need to be created
        critical_threshold, incident_times = generate_incident_times(
            self.timestamps_by_project[project.slug], time_interval, self.get_config_var("MAX_DAYS")
        )

        critical_trigger = create_alert_rule_trigger(alert_rule, "critical", critical_threshold)

        create_alert_rule_trigger_action(
            critical_trigger,
            AlertRuleTriggerAction.Type.EMAIL,
            AlertRuleTriggerAction.TargetType.TEAM,
            target_identifier=str(team.id),
        )

        # create alerts
        for start_time, end_time in incident_times:
            incident = create_incident(
                organization=org,
                type_=IncidentType.ALERT_TRIGGERED,
                title=f"{critical_threshold} Errors",
                date_started=start_time,
                projects=[project],
                alert_rule=alert_rule,
            )

            # update alert status
            update_incident_status(incident, status=IncidentStatus.CRITICAL)

            # close alert
            update_incident_status(
                incident,
                IncidentStatus.CLOSED,
                date_closed=end_time,
            )

            # update date_added for timeline on side
            # alert created
            created = IncidentActivity.objects.filter(
                incident=incident, type=IncidentActivityType.CREATED.value
            ).first()
            # create at end of interval right after trigger detected
            # doesn't go off end time in case there are adjacent intervals
            created.update(date_added=start_time + timedelta(minutes=time_interval + 1))

            # alert status changed
            changed = IncidentActivity.objects.filter(
                incident=incident,
                type=IncidentActivityType.STATUS_CHANGE.value,
                value=IncidentStatus.CRITICAL.value,
            ).first()
            # change alert statue right after alert created, creation needs to happen first for the timeline
            # randomness added so not the same duration
            change_time = random.randint(30, 60)
            changed.update(
                date_added=start_time + timedelta(minutes=time_interval + 1, seconds=change_time)
            )
            # resolved
            resolved = IncidentActivity.objects.filter(
                incident=incident,
                type=IncidentActivityType.STATUS_CHANGE.value,
                value=IncidentStatus.CLOSED.value,
            ).first()
            # end alert after the alert change so constant added to make sure the date added is later
            resolved.update(date_added=end_time + timedelta(minutes=3))

    def generate_issue_alert(self, project):
        org = project.organization
        team = Team.objects.filter(organization=org).first()

        data = {
            "name": "New Sentry Issue",
            "actions": [
                {
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "name": "Send an email to Team",
                    "targetIdentifier": str(team.id),
                    "targetType": "Team",
                }
            ],
            "conditions": [
                {
                    "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
                    "name": "A new issue is created",
                }
            ],
            "action_match": "all",
            "filter_match": "all",
            "project": project,
            "frequency": 30,
        }
        project_rules.Creator.run(**data)

    def generate_saved_query(self, project, transaction_title, name):
        org = project.organization
        start, end = get_date_range_from_params({})
        params = {"start": start, "end": end, "project_id": [project.id], "organization_id": org.id}
        data = {
            "version": 2,
            "name": name,
            "fields": [
                "title",
                "browser.name",
                "count()",
                "p75(transaction.duration)",
                "p95(transaction.duration)",
                "p99(transaction.duration)",
            ],
            "widths": ["-1", "-1", "-1", "-1", "-1", "-1"],
            "orderby": "-count",
            "query": f"title:{transaction_title}",
            "projects": [project.id],
            "range": "7d",
            "environment": [],
            "yAxis": ["p75(transaction.duration)"],
            "display": "daily",
        }

        serializer = DiscoverSavedQuerySerializer(data=data, context={"params": params})
        if not serializer.is_valid():
            raise Exception(serializer.errors)

        data = serializer.validated_data
        DiscoverSavedQuery.objects.create(
            organization=org,
            name=data["name"],
            query=data["query"],
            version=data["version"],
        )

    def generate_saved_search(self, projects):
        SavedSearch.objects.filter().delete()
        global_params = saved_search_by_platform["global"]
        for params in global_params:
            name, query = params
            SavedSearch.objects.get_or_create(
                is_global=True, organization=self.org, name=name, query=query
            )
        for project in projects:
            project_params = saved_search_by_platform[project.platform]
            for params in project_params:
                name, query = params
                SavedSearch.objects.get_or_create(
                    project=project, organization=self.org, name=name, query=query
                )

    def inbox_issues(self):
        assigned_issues = GroupAssignee.objects.filter(project__organization=self.org)
        assigned_groups = [assignee.group for assignee in assigned_issues]
        groups = Group.objects.filter(project__organization=self.org)
        unassigned_groups = [group for group in groups if group not in assigned_groups]

        reasons = [GroupInboxReason.REGRESSION, GroupInboxReason.NEW]
        ignore_rate = 0.1

        for group in groups:
            outcome = random.random()
            if outcome < ignore_rate:
                group.update(status=GroupStatus.IGNORED)
            elif group in unassigned_groups:
                group_inbox = add_group_to_inbox(group, random.choice(reasons))
                group_inbox.update(date_added=group.first_seen)

    def assign_issues(self):
        org_members = OrganizationMember.objects.filter(organization=self.org, role="member")
        for group in Group.objects.filter(project__organization=self.org):
            # assign 2/3rds of issues to a random user in our org
            if random.random() > 0.33:
                member = random.choice(org_members)
                GroupAssignee.objects.assign(group, member.user)

    def iter_timestamps(self, distribution_fn_num: int, starting_release: int = 0):
        """
        Yields a series of ordered timestamps and the day in a tuple
        """

        # distribution_fn_num starts at 1 instead of 0
        distribution_fn = distribution_fns[distribution_fn_num - 1]

        MAX_DAYS = self.get_config_var("MAX_DAYS")
        SCALE_FACTOR = self.get_config_var("SCALE_FACTOR")
        BASE_OFFSET = self.get_config_var("BASE_OFFSET")
        NUM_RELEASES = self.get_config_var("NUM_RELEASES")
        start_time = timezone.now() - timedelta(days=MAX_DAYS)

        # offset by the release time
        hourly_release_cadence = MAX_DAYS * 24.0 / NUM_RELEASES
        start_time += timedelta(hours=hourly_release_cadence * starting_release)

        for day in range(MAX_DAYS):
            for hour in range(24):
                # quit when we start to populate events in the future
                end_time = start_time + timedelta(days=day, hours=hour + 1)
                if end_time > timezone.now():
                    return

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

    def populate_connected_event_scenario_1(self, react_project: Project, python_project: Project):
        """
        This function populates a set of four related events with the same trace id:
        - Front-end transaction
        - Front-end error
        - Back-end transaction
        - Back-end error
        Occurrence times and durations are randomized
        """
        react_transaction = get_event_from_file("scen1/react_transaction.json")
        react_error = get_event_from_file("scen1/react_error.json")
        python_transaction = get_event_from_file("scen1/python_transaction.json")
        python_error = get_event_from_file("scen1/python_error.json")

        self.log_info("populate_connected_event_scenario_1.start")

        for (timestamp, day) in self.iter_timestamps(1):
            transaction_user = self.generate_user()
            trace_id = uuid4().hex
            release = get_release_from_time(react_project.organization_id, timestamp)
            release_sha = release.version

            old_span_id = react_transaction["contexts"]["trace"]["span_id"]
            frontend_root_span_id = uuid4().hex[:16]
            frontend_duration = self.gen_frontend_duration(day)

            frontend_trace = {
                "trace_id": trace_id,
                "span_id": frontend_root_span_id,
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
                measurements=gen_measurements(frontend_duration),
            )
            update_context(local_event, frontend_trace)
            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

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
            )
            update_context(local_event, frontend_trace)
            self.fix_error_event(local_event)
            self.safe_send_event(local_event)

            # python transaction
            old_span_id = python_transaction["contexts"]["trace"]["span_id"]
            backend_duration = frontend_duration * random.uniform(0.8, 0.95)

            backend_trace = {
                "trace_id": trace_id,
                "span_id": uuid4().hex[:16],
                "parent_span_id": backend_parent_id,
            }

            local_event = copy.deepcopy(python_transaction)
            local_event.update(
                project=python_project,
                platform=python_project.platform,
                timestamp=timestamp,
                start_timestamp=timestamp - timedelta(seconds=backend_duration),
                user=transaction_user,
                release=release_sha,
            )
            update_context(local_event, backend_trace)
            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

            # python error
            local_event = copy.deepcopy(python_error)
            local_event.update(
                project=python_project,
                platform=python_project.platform,
                timestamp=timestamp,
                user=transaction_user,
                release=release_sha,
            )
            update_context(local_event, backend_trace)
            self.fix_error_event(local_event)
            self.safe_send_event(local_event)

        self.log_info("populate_connected_event_scenario_1.finished")

    def populate_connected_event_scenario_1b(self, react_project: Project, python_project: Project):
        react_transaction = get_event_from_file("scen1b/react_transaction.json")
        python_transaction = get_event_from_file("scen1b/python_transaction.json")

        self.log_info("populate_connected_event_scenario_1b.start")

        for (timestamp, day) in self.iter_timestamps(2):
            transaction_user = self.generate_user()
            trace_id = uuid4().hex
            release = get_release_from_time(react_project.organization_id, timestamp)
            release_sha = release.version

            old_span_id = react_transaction["contexts"]["trace"]["span_id"]
            frontend_root_span_id = uuid4().hex[:16]
            frontend_duration = self.gen_frontend_duration(day)

            frontend_trace = {
                "trace_id": trace_id,
                "span_id": frontend_root_span_id,
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
                measurements=gen_measurements(frontend_duration),
            )
            update_context(local_event, frontend_trace)
            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

            # note picking the 0th span is arbitrary
            backend_parent_id = local_event["spans"][0]["span_id"]

            # python transaction
            old_span_id = python_transaction["contexts"]["trace"]["span_id"]
            backend_duration = frontend_duration * random.uniform(0.8, 0.95)

            backend_trace = {
                "trace_id": trace_id,
                "span_id": uuid4().hex[:16],
                "parent_span_id": backend_parent_id,
            }

            local_event = copy.deepcopy(python_transaction)
            local_event.update(
                project=python_project,
                platform=python_project.platform,
                timestamp=timestamp,
                start_timestamp=timestamp - timedelta(seconds=backend_duration),
                user=transaction_user,
                release=release_sha,
            )
            update_context(local_event, backend_trace)
            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

        self.log_info("populate_connected_event_scenario_1b.finished")

    def populate_connected_event_scenario_2(self, react_project: Project, python_project: Project):
        """
        This function populates a set of two related events with the same trace id:
        - Front-end transaction
        - Back-end transaction
        Occurrence times and durations are randomized
        """
        react_transaction = get_event_from_file("scen2/react_transaction.json")
        python_transaction = get_event_from_file("scen2/python_transaction.json")

        self.log_info("populate_connected_event_scenario_2.start")

        for (timestamp, day) in self.iter_timestamps(2):
            transaction_user = self.generate_user()
            trace_id = uuid4().hex
            release = get_release_from_time(react_project.organization_id, timestamp)
            release_sha = release.version

            old_span_id = react_transaction["contexts"]["trace"]["span_id"]
            frontend_root_span_id = uuid4().hex[:16]
            frontend_duration = self.gen_frontend_duration(day)

            frontend_trace = {
                "trace_id": trace_id,
                "span_id": frontend_root_span_id,
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
                measurements=gen_measurements(frontend_duration),
            )
            update_context(local_event, frontend_trace)

            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

            # note picking the 0th span is arbitrary
            backend_parent_id = local_event["spans"][0]["span_id"]

            # python transaction
            old_span_id = python_transaction["contexts"]["trace"]["span_id"]
            backend_duration = frontend_duration * random.uniform(0.8, 0.95)

            backend_trace = {
                "trace_id": trace_id,
                "span_id": uuid4().hex[:16],
                "parent_span_id": backend_parent_id,
            }

            local_event = copy.deepcopy(python_transaction)
            local_event.update(
                project=python_project,
                platform=python_project.platform,
                timestamp=timestamp,
                start_timestamp=timestamp - timedelta(seconds=backend_duration),
                user=transaction_user,
                release=release_sha,
            )
            update_context(local_event, backend_trace)
            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

        self.log_info("populate_connected_event_scenario_2.finished")

    def populate_connected_event_scenario_3(self, ios_project: Project):

        ios_error = get_event_from_file("scen3/handled.json")
        ios_transaction = get_event_from_file("scen3/ios_transaction.json")

        self.log_info("populate_connected_event_scenario_3.start")

        for (timestamp, day) in self.iter_timestamps(4):
            transaction_user = self.generate_user()
            trace_id = uuid4().hex
            release = get_release_from_time(ios_project.organization_id, timestamp)
            release_sha = release.version

            old_span_id = ios_transaction["contexts"]["trace"]["span_id"]
            root_span_id = uuid4().hex[:16]
            duration = self.gen_frontend_duration(day)

            trace = {
                "trace_id": trace_id,
                "span_id": root_span_id,
            }

            # iOS transaction
            local_event = copy.deepcopy(ios_transaction)
            local_event.update(
                project=ios_project,
                platform=ios_project.platform,
                event_id=uuid4().hex,
                user=transaction_user,
                release=release_sha,
                timestamp=timestamp,
                start_timestamp=timestamp - timedelta(seconds=duration),
            )
            update_context(local_event, trace, platform=ios_project.platform)
            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

            # iOS Error
            local_event = copy.deepcopy(ios_error)
            local_event.update(
                project=ios_project,
                platform=ios_project.platform,
                timestamp=timestamp,
                user=transaction_user,
                release=release_sha,
            )
            update_context(local_event, trace, platform=ios_project.platform)
            self.fix_error_event(local_event)
            self.safe_send_event(local_event)

        self.log_info("populate_connected_event_scenario_3.finished")

    def populate_generic_error(
        self, project: Project, file_path, dist_number, mobile=False, starting_release=0
    ):
        """
        This function populates a single error
        Occurrence times and durations are randomized
        """
        error = get_event_from_file(file_path)

        self.log_info("populate_generic_error.start")

        for (timestamp, day) in self.iter_timestamps(dist_number, starting_release):
            transaction_user = self.generate_user()
            release = get_release_from_time(project.organization_id, timestamp)
            release_sha = release.version

            local_event = copy.deepcopy(error)
            local_event.update(
                project=project,
                platform=project.platform,
                timestamp=timestamp,
                user=transaction_user,
                release=release_sha,
            )
            update_context(local_event, platform=project.platform)
            self.fix_error_event(local_event)
            self.safe_send_event(local_event)

        self.log_info("populate_generic_error.finished")

    def populate_generic_transaction(
        self,
        project: Project,
        file_path,
        dist_number,
        mobile,
        starting_release=0,
    ):
        """
        This function populates a single transaction
        Occurrence times and durations are randomized
        """
        transaction = get_event_from_file(file_path)

        self.log_info("populate_generic_transaction.start")

        for (timestamp, day) in self.iter_timestamps(dist_number, starting_release):
            transaction_user = self.generate_user()
            release = get_release_from_time(project.organization_id, timestamp)
            release_sha = release.version

            old_span_id = transaction["contexts"]["trace"]["span_id"]
            duration = self.gen_frontend_duration(day)

            local_event = copy.deepcopy(transaction)
            local_event.update(
                project=project,
                platform=project.platform,
                event_id=uuid4().hex,
                user=transaction_user,
                release=release_sha,
                timestamp=timestamp,
                start_timestamp=timestamp - timedelta(seconds=duration),
            )

            update_context(local_event, platform=project.platform)

            self.fix_transaction_event(local_event, old_span_id)
            self.safe_send_event(local_event)

        self.log_info("populate_generic_error.finished")

    def populate_sessions(self, project, distribution_fn_num: int, mobile: bool, error_file=None):
        self.log_info("populate_sessions.start")

        dsn = ProjectKey.objects.get(project=project)

        if error_file:
            error = get_event_from_file(error_file)

        # keep track of versions for mobile
        seen_versions = []
        num_versions = 0
        weights = []
        ind_session_threshold = self.get_config_var("IND_SESSION_THRESHOLD")

        for (timestamp, day) in self.iter_timestamps(distribution_fn_num):
            transaction_user = self.generate_user()
            sid = uuid4().hex
            release = get_release_from_time(project.organization_id, timestamp)
            version = release.version

            # add new version if necessary
            if version not in seen_versions:
                seen_versions.append(version)
                num_versions += 1
                if weights:
                    weights.append(weights[-1] * random.uniform(2, 2.5))
                else:
                    weights = [1]

            if not self.get_config_var("DISABLE_AGGREGATE_SESSIONS"):
                self.send_aggr_session(
                    dsn, timestamp, mobile, version, num_versions, seen_versions, weights
                )

            outcome = random.random()
            if outcome < ind_session_threshold:
                continue
            # send sessions for duration info
            session_data = {"init": True}
            self.send_session(sid, transaction_user["id"], dsn, timestamp, version, **session_data)
            release_num = int(version.split(".")[-1])
            threshold = rate_by_release_num[release_num]
            outcome = random.random()
            if outcome > threshold:
                if error_file:
                    local_event = copy.deepcopy(error)
                    local_event.update(
                        project=project,
                        platform=project.platform,
                        timestamp=timestamp,
                        user=transaction_user,
                        release=version,
                    )
                    update_context(local_event)
                    self.fix_error_event(local_event)
                    self.safe_send_event(local_event)

                data = {
                    "status": "crashed",
                }
            else:
                data = {
                    "status": "exited",
                }

            self.send_session(sid, transaction_user["id"], dsn, timestamp, version, **data)

        self.log_info("populate_sessions.end")

    @catch_and_log_errors
    def send_session(self, sid, user_id, dsn, time, release, **kwargs):
        """
        Creates an envelope payload for a session and posts it to Relay
        """
        formatted_time = time.isoformat()
        envelope_headers = "{}"
        item_headers = json.dumps({"type": "session"})
        data = {
            "sid": sid,
            "did": str(user_id),
            "started": formatted_time,
            "duration": random.randrange(2, 60),
            "attrs": {
                "release": release,
                "environment": "prod",
            },
        }
        data.update(**kwargs)
        core = json.dumps(data)

        body = f"{envelope_headers}\n{item_headers}\n{core}"
        endpoint = dsn.get_endpoint()
        url = f"{endpoint}/api/{dsn.project_id}/envelope/?sentry_key={dsn.public_key}&sentry_version=7"
        resp = requests.post(url=url, data=body)
        resp.raise_for_status()

    @catch_and_log_errors
    def send_aggr_session(self, dsn, time, mobile, version, num_versions, seen_versions, weights):
        formatted_time = time.isoformat()
        envelope_headers = "{}"
        item_headers = json.dumps({"type": "sessions"})

        # if mobile, choose one of previously seen versions
        if mobile and num_versions > 1:
            version = random.choices(seen_versions, k=1, weights=weights)[0]

        agg = []
        release_num = int(version.split(".")[-1])
        success = agg_rate_by_release_num[release_num]
        failure = 1 - success

        num_users = int(random.uniform(70, 100))

        # create session data for each user
        for _ in range(num_users):

            num_session = random.choices([1, 2, 3], k=1, weights=[5, 3, 2])[0]
            exited = sum(random.choices([1, 0], k=num_session, weights=[success, failure]))
            crashed = num_session - exited

            current = {
                "started": formatted_time,
                "did": uuid4().hex[:8],
                "exited": exited,
                "crashed": crashed,
            }
            agg.append(current)

        data = {
            "aggregates": agg,
            "attrs": {"release": version, "environment": "prod"},
        }

        core = json.dumps(data)
        body = f"{envelope_headers}\n{item_headers}\n{core}"
        endpoint = dsn.get_endpoint()
        url = f"{endpoint}/api/{dsn.project_id}/envelope/?sentry_key={dsn.public_key}&sentry_version=7"
        resp = requests.post(url=url, data=body)
        resp.raise_for_status()

    def handle_react_python_scenario(self, react_project: Project, python_project: Project):
        with sentry_sdk.start_span(
            op="handle_react_python_scenario", description="pre_event_setup"
        ):
            self.generate_saved_query(react_project, "/productstore", "Product Store by Browser")

        if not self.get_config_var("DISABLE_SESSIONS"):
            with sentry_sdk.start_span(
                op="handle_react_python_scenario", description="populate_sessions"
            ):
                self.populate_sessions(
                    react_project, 7, False, "sessions/react_unhandled_exception.json"
                )
                self.populate_sessions(
                    python_project, 10, False, "sessions/python_unhandled_exception.json"
                )

        with sentry_sdk.start_span(
            op="handle_react_python_scenario", description="populate_connected_events"
        ):
            self.populate_connected_event_scenario_1(react_project, python_project)
            self.populate_connected_event_scenario_1b(react_project, python_project)
            self.populate_connected_event_scenario_2(react_project, python_project)
        with sentry_sdk.start_span(
            op="handle_react_python_scenario", description="populate_errors"
        ):
            self.populate_generic_error(
                react_project, "errors/react/get_card_info.json", 2, starting_release=2
            )
            self.populate_generic_error(react_project, "errors/react/func_undefined.json", 3)
            self.populate_generic_error(python_project, "errors/python/cert_error.json", 5)
            self.populate_generic_error(
                python_project, "errors/python/concat_str_none.json", 4, starting_release=1
            )
        self.assign_issues()
        self.inbox_issues()
        self.generate_alerts(python_project)

    def handle_mobile_scenario(
        self, ios_project: Project, android_project: Project, react_native_project: Project
    ):
        if not self.get_config_var("DISABLE_SESSIONS"):
            with sentry_sdk.start_span(
                op="handle_react_python_scenario", description="populate_sessions"
            ):
                self.populate_sessions(ios_project, 6, True)
                self.populate_sessions(android_project, 8, True)
                self.populate_sessions(react_native_project, 9, True)
        with sentry_sdk.start_span(op="handle_mobile_scenario", description="populate_connected"):
            self.populate_connected_event_scenario_3(ios_project)
        with sentry_sdk.start_span(op="handle_mobile_scenario", description="populate_errors"):
            self.populate_generic_error(
                ios_project, "errors/ios/exc_bad_access.json", 3, mobile=True
            )

            self.populate_generic_error(
                android_project,
                "errors/android/out_of_bounds.json",
                2,
                mobile=True,
                starting_release=2,
            )
            self.populate_generic_error(
                android_project, "errors/android/app_not_responding.json", 3, mobile=True
            )
            self.populate_generic_error(
                react_native_project, "errors/react_native/out_of_memory.json", 5, mobile=True
            )
            self.populate_generic_error(
                react_native_project,
                "errors/react_native/promise_rejection.json",
                3,
                mobile=True,
                starting_release=2,
            )
        self.assign_issues()
        self.inbox_issues()
        self.generate_alerts(android_project)
