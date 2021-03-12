import logging
import functools
import random
from typing import (
    List,
    Callable,
)

from datetime import timedelta
from django.utils import timezone
from sentry.interfaces.user import User as UserInterface
from sentry.models import Project
from sentry.utils import json
from sentry.utils.samples import random_geo, random_ip, create_sample_event
from sentry.utils.snuba import SnubaError


MAX_DAYS = 2
SCALE_FACTOR = 0.5
BASE_OFFSET = 0.5
NAME_STEP_SIZE = 20


logger = logging.getLogger(__name__)


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


def generate_user():
    name_list = get_list_of_names()
    id_0_offset = random.randrange(0, len(name_list), NAME_STEP_SIZE)
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


def populate_event_on_project(
    project: Project, file_path: str, dist_function: Callable[[int], int]
) -> None:
    with open(file_path) as f:
        error_json = json.load(f)

    # clear out these fields if they exist
    fields_to_delete = ["datetime", "location", "title", "event_id", "project"]
    for field in fields_to_delete:
        if field in error_json:
            del error_json[field]

    for day in range(MAX_DAYS):
        for hour in range(24):
            base = dist_function(hour)
            # determine the number of events we want in this hour
            num_events = int((BASE_OFFSET + SCALE_FACTOR * base) * random.uniform(0.6, 1.0))
            for i in range(num_events):
                # pick the minutes randomly (which means events will received be out of order)
                minute = random.randint(0, 60)
                timestamp = timezone.now() - timedelta(days=day, hours=hour, minutes=minute)
                local_error = error_json.copy()
                local_error.update(
                    project=project,
                    platform=project.platform,
                    timestamp=timestamp,
                    user=generate_user(),
                )
                # snuba might fail but what can we do ¯\_(ツ)_/¯
                # TODO: make a batched update version of create_sample_event
                try:
                    create_sample_event(
                        **local_error,
                    )
                except SnubaError:
                    logger.info("populate_event_on_project.snuba_error")
                    pass


def populate_python_project(project: Project):
    populate_event_on_project(
        project, "src/sentry/demo/data/python_error_1.json", distrubtion_fns[2]
    )


def populate_react_project(project: Project):
    populate_event_on_project(
        project, "src/sentry/demo/data/react_error_1.json", distrubtion_fns[0]
    )
    populate_event_on_project(
        project, "src/sentry/demo/data/react_error_2.json", distrubtion_fns[1]
    )
