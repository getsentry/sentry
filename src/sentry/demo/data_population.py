import copy
import functools
import logging
import os
import random
import time
from collections import defaultdict
from datetime import timedelta
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
)
from sentry.incidents.models import AlertRuleThresholdType, AlertRuleTriggerAction
from sentry.interfaces.user import User as UserInterface
from sentry.mediators import project_rules
from sentry.models import (
    Commit,
    CommitAuthor,
    CommitFileChange,
    File,
    Group,
    GroupAssignee,
    Organization,
    OrganizationMember,
    OrganizationMemberTeam,
    Project,
    ProjectKey,
    Release,
    ReleaseCommit,
    ReleaseFile,
    Repository,
    Team,
    User,
)
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

crash_free_rate_by_release = [1.0, 0.99, 0.9]
# higher crash rate if we are doing a quick org
crash_free_rate_by_release_quick = [1.0, 0.95, 0.75]

org_users = [
    ("scefali", "Stephen Cefali"),
    ("aj", "AJ Jindal"),
    (
        "jennifer.song",
        "Jen Song",
    ),
]

logger = logging.getLogger(__name__)


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
        return 14
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


def distribution_v4(hour: int) -> int:
    if hour > 13 and hour < 20:
        return 11
    if hour > 5 and hour < 12:
        return 7
    if hour > 3 and hour < 22:
        return 4
    return 2


def distribution_v5(hour: int) -> int:
    if hour == 3:
        return 10
    if hour < 5:
        return 3
    return 1


distrubtion_fns = [
    distribution_v1,
    distribution_v2,
    distribution_v3,
    distribution_v4,
    distribution_v5,
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


def update_context(event, trace=None):
    context = event["contexts"]
    # delete device since we aren't mocking it (yet)
    if "device" in context:
        del context["device"]
    # generate ranndom browser and os
    context.update(**gen_base_context())
    # add our trace info
    base_trace = context.get("trace", {})
    if not trace:
        trace = {
            "trace_id": uuid4().hex,
            "span_id": uuid4().hex[:16],
        }
    base_trace.update(**trace)
    context["trace"] = base_trace


def populate_org_members(org, team):
    for user_info in org_users:
        (email_base, name) = user_info
        email = create_fake_email(email_base, "demo")
        user, _ = User.objects.get_or_create(name=name, email=email, is_managed=True)
        member = OrganizationMember.objects.create(user=user, organization=org, role="member")
        OrganizationMemberTeam.objects.create(team=team, organizationmember=member, is_active=True)


class DataPopulation:
    """
    This class is used to populate data for a single organization
    """

    def __init__(self, org: Organization, quick: bool):
        self.org = org
        self.quick = quick

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
        config = self.get_config()
        DAY_DURATION_IMPACT = config["DAY_DURATION_IMPACT"]
        MAX_DAYS = config["MAX_DAYS"]
        MIN_FRONTEND_DURATION = config["MIN_FRONTEND_DURATION"]
        day_weight = DAY_DURATION_IMPACT * day / MAX_DAYS

        alpha = config["DURATION_ALPHA"]
        beta = config["DURATION_BETA"]
        return MIN_FRONTEND_DURATION / 1000.0 + random.gammavariate(alpha, beta) / (1 + day_weight)

    def fix_breadrumbs(self, event_json):
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
        for an evnet
        """
        event_json["timestamp"] = to_timestamp(event_json["timestamp"])
        start_timestamp = event_json.get("start_timestamp")
        if start_timestamp:
            event_json["start_timestamp"] = to_timestamp(start_timestamp)

    def fix_error_event(self, event_json):
        self.fix_timestamps(event_json)
        self.fix_breadrumbs(event_json)

    def fix_transaction_event(self, event_json, old_span_id):
        self.fix_timestamps(event_json)
        fix_spans(event_json, old_span_id)
        fix_measurements(event_json)

    def safe_send_event(self, data):
        project = data.pop("project")
        config = self.get_config()
        try:
            create_sample_event_basic(data, project.id)
            time.sleep(config["DEFAULT_BACKOFF_TIME"])
        except SnubaError:
            # if snuba fails, just back off and continue
            self.log_info("safe_send_event.snuba_error")
            time.sleep(config["ERROR_BACKOFF_TIME"])

    @catch_and_log_errors
    def send_session(self, sid, user_id, dsn, time, release, **kwargs):
        """
        Creates an envelope payload for a session and posts it to Relay
        """
        formated_time = time.isoformat()
        envelope_headers = "{}"
        item_headers = json.dumps({"type": "session"})
        data = {
            "sid": sid,
            "did": str(user_id),
            "started": formated_time,
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

    def generate_releases(self, projects):
        config = self.get_config()
        NUM_RELEASES = config["NUM_RELEASES"]
        MAX_DAYS = config["MAX_DAYS"]
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

    def generate_alerts(self, project):
        self.generate_metric_alert(project)
        self.generate_issue_alert(project)

    def generate_metric_alert(self, project):
        org = project.organization
        team = Team.objects.filter(organization=org).first()
        alert_rule = create_alert_rule(
            org,
            [project],
            "High Error Rate",
            "level:error",
            "count()",
            10,
            AlertRuleThresholdType.ABOVE,
            1,
        )
        critical_trigger = create_alert_rule_trigger(alert_rule, "critical", 10)
        warning_trigger = create_alert_rule_trigger(alert_rule, "warning", 7)
        for trigger in [critical_trigger, warning_trigger]:
            create_alert_rule_trigger_action(
                trigger,
                AlertRuleTriggerAction.Type.EMAIL,
                AlertRuleTriggerAction.TargetType.TEAM,
                target_identifier=str(team.id),
            )

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
            "yAxis": "p75(transaction.duration)",
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

    def assign_issues(self):
        org_members = OrganizationMember.objects.filter(organization=self.org, role="member")
        for group in Group.objects.filter(project__organization=self.org):
            # assign 2/3rds of issues to a random user in our org
            if random.random() > 0.33:
                member = random.choice(org_members)
                GroupAssignee.objects.assign(group, member.user)

    def iter_timestamps(self, disribution_fn_num: int, starting_release: int = 0):
        """
        Yields a series of ordered timestamps and the day in a tuple
        """

        # disribution_fn_num starts at 1 instead of 0
        distribution_fn = distrubtion_fns[disribution_fn_num - 1]

        config = self.get_config()
        MAX_DAYS = config["MAX_DAYS"]
        SCALE_FACTOR = config["SCALE_FACTOR"]
        BASE_OFFSET = config["BASE_OFFSET"]
        NUM_RELEASES = config["NUM_RELEASES"]
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
        Occurrance times and durations are randomized
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
        Occurrance times and durations are randomized
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

    def populate_generic_error(self, project: Project, file_path, dist_number, starting_release=0):
        """
        This function populates a single error
        Occurrance times and durations are randomized
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
            update_context(local_event)
            self.fix_error_event(local_event)
            self.safe_send_event(local_event)
        self.log_info("populate_generic_error.finished")

    def populate_sessions(self, project, error_file):
        self.log_info("populate_sessions.start")
        dsn = ProjectKey.objects.get(project=project)

        react_error = get_event_from_file(error_file)

        for (timestamp, day) in self.iter_timestamps(4):
            transaction_user = self.generate_user()
            sid = uuid4().hex
            release = get_release_from_time(project.organization_id, timestamp)
            version = release.version

            # initialize the session
            session_data = {
                "init": True,
            }
            self.send_session(sid, transaction_user["id"], dsn, timestamp, version, **session_data)

            # determine if this session should crash or exit with success
            rate_by_release_num = (
                crash_free_rate_by_release_quick if self.quick else crash_free_rate_by_release
            )
            # get the release num from the last part of the version
            release_num = int(version.split(".")[-1])
            threshold = rate_by_release_num[release_num]
            outcome = random.random()
            if outcome > threshold:
                # if crash, make an error for it
                local_event = copy.deepcopy(react_error)
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

    def handle_react_python_scenario(self, react_project: Project, python_project: Project):
        with sentry_sdk.start_span(
            op="handle_react_python_scenario", description="pre_event_setup"
        ):
            self.generate_releases([react_project, python_project])
            self.generate_alerts(python_project)
            self.generate_saved_query(react_project, "/productstore", "Product Store by Browser")
        if not self.get_config_var("DISABLE_SESSIONS"):
            with sentry_sdk.start_span(
                op="handle_react_python_scenario", description="populate_sessions"
            ):
                self.populate_sessions(react_project, "sessions/react_unhandled_exception.json")
                self.populate_sessions(python_project, "sessions/python_unhandled_exception.json")
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
                react_project, "errors/react/get_card_info.json", 3, starting_release=1
            )
            self.populate_generic_error(
                python_project, "errors/python/cert_error.json", 5, starting_release=1
            )
            self.populate_generic_error(
                react_project, "errors/react/func_undefined.json", 2, starting_release=2
            )
            self.populate_generic_error(
                python_project, "errors/python/concat_str_none.json", 4, starting_release=2
            )
        self.assign_issues()


def handle_react_python_scenario(react_project: Project, python_project: Project, quick=False):
    """
    Handles all data population for the React + Python scenario
    """
    data_population = DataPopulation(python_project.organization, quick)
    data_population.handle_react_python_scenario(react_project, python_project)
