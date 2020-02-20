# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import datetime

from django.db import IntegrityError

from sentry import eventstore
import requests

from sentry.testutils import adjust_settings_for_relay_tests
from sentry.testutils.helpers import get_auth_header

from sentry.models import Relay
import time

# Poll this amount of times (for 0.1 sec each) at most to wait for messages
SLEEP_TIME_WHILE_WAITING_FOR_CONSUMER = 0.1  # seconds
MAX_SECONDS_WAITING_FOR_EVENT = 8  # seconds


def test_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_2(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_3(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_4(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_5(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_6(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_7(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_8(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_9(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_10(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_1_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_2_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_3_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_4_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_5_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_6_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_7_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_8_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_9_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def test_10_1(
    settings,
    live_server,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):
    t_relay(
        settings,
        relay_server,
        task_runner,
        session_ingest_consumer,
        default_project,
        default_projectkey,
    )


def t_relay(
    settings,
    relay_server,
    task_runner,
    session_ingest_consumer,
    default_project,
    default_projectkey,
):

    adjust_settings_for_relay_tests(settings)

    project = default_project
    projectkey = default_projectkey

    try:
        Relay.objects.create(
            relay_id="88888888-4444-4444-8444-cccccccccccc",
            public_key="SMSesqan65THCV6M4qs4kBzPai60LzuDn-xNsvYpuP8",
            is_internal=True,
        )
    except IntegrityError:
        #  this should happen for the first test that runs after relay registers with upstream (i.e. first test using
        #  relay)
        pass

    auth = get_auth_header(
        "TEST_USER_AGENT/0.0.0", projectkey.public_key, projectkey.secret_key, "7"
    )

    url = "{}/api/{}/store/".format(relay_server["url"], projectkey.project_id)

    timestamp = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S_%f")
    message = "test_simple_{}".format(timestamp)
    data = '{{"message": "{}", "extra": "{}"}}'.format(message, timestamp)
    # send request to relay
    response = requests.post(
        url, headers={"x-sentry-auth": auth, "content-type": "application/json"}, data=bytes(data)
    )

    assert response.ok
    resp_body = response.json()
    event_id = resp_body["id"]

    # simulate the event ingestion task by running the ingest consumer
    consumer = session_ingest_consumer(settings)

    event = None
    start_wait = time.time()
    with task_runner():
        while time.time() - start_wait < MAX_SECONDS_WAITING_FOR_EVENT:
            consumer._run_once()
            # check event has reached snuba
            event = eventstore.get_event_by_id(project.id, event_id)
            if event is not None:
                break

    # Found the event in snuba
    assert event is not None
