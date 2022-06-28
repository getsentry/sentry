#!/usr/bin/env python

from sentry.runner import configure

configure()

import pprint
import signal
import time

import ipdb
import requests

from sentry.models.projectkey import ProjectKey

LIVE = True
# the first 9 projects arent for testing the endpoint. this may be different in your local environment
PROJ_START_OFFSET = 9
NUM_PROJECTS = 100
MAX_BATCH_LEN = 5  # max of projects in a single request

BASE_URL = "http://localhost:8000/"
PROJECT_CONFIG_URL = "api/0/relays/projectconfigs/"
DEFAULT_HEADERS = {"version": "3", "fullConfig": "True", "noCache": "False"}


def ctrlC_handler(_signal, _frame):
    global LIVE
    LIVE = False


def get_project_keys():
    public_keys = []
    for i in range(PROJ_START_OFFSET, PROJ_START_OFFSET + NUM_PROJECTS):
        key = ProjectKey.objects.get(id=i)
        public_keys.append(key.public_key)
    return public_keys


signal.signal(signal.SIGINT, ctrlC_handler)


def request_batch(batch):
    # print(f"requesting batch of {len(batch)}...")

    url = f"{BASE_URL}{PROJECT_CONFIG_URL}"
    headers = DEFAULT_HEADERS.copy()
    headers["publickeys"] = ":".join(batch)  # temporary protocol

    return requests.post(url, headers=headers).json()


def update_stats(response, stats):
    """Updates the stats with the provided response from the server."""
    for key in response.get("pending", []):
        stats[key][-1] += 1

    for key in response.get("configs", []):
        stats[key][-1] += 1
        stats[key].append(0)

    return stats


def prepare_next_batch(response, keys, key_idx, stats):
    next_batch = [key for key in response.get("pending", [])]
    remaining_seats = MAX_BATCH_LEN - len(next_batch)
    if remaining_seats <= 0:
        return next_batch, key_idx

    next_keys, idx = get_next_keys(keys, key_idx, remaining_seats, stats)
    next_batch.extend(next_keys)

    # Try to get another batch of keys, in case we needed to reset the key
    remaining_seats = MAX_BATCH_LEN - len(next_batch)
    if remaining_seats > 0:
        more_keys, idx = get_next_keys(keys, key_idx, remaining_seats, stats)
        next_batch.extend(more_keys)

    return next_batch, idx


def get_next_keys(keys, key_idx, amount, stats):
    if key_idx >= len(keys):
        key_idx = 0

    rv = []
    remaining = min(len(keys), key_idx + amount)
    if remaining <= 0:
        return rv, key_idx

    rv.extend(keys[key_idx:remaining])
    return rv, key_idx + remaining


"""
dictionary mapping from a project's public key to a list.
each list index represents the amount of requests that took to fetch the config
of a project, where the total amount is the sum of all pendings plus the last
config response. The last `0` doesnt have any meaning.

for example:
stats == {key1: [3, 2, 0]}
means: there were 2 rounds (`len(stats) - 1`); the first round took 3 requests
to resolve (two pendings + one config), and the second round 2 requests
(one pending + one config).

note:
pending projects in the last response are prioritized over everything else. this
means that in cases where the server returns pending for all projects, the
following request will be the same, creating a chance for infinite loops.
"""
keys = get_project_keys()
stats = {key: [0] for key in keys}
batch = keys[:MAX_BATCH_LEN]
key_idx = len(batch)

print("\nSmashing the endpoint. Press ^C to stop.")

while LIVE:
    res = request_batch(batch)
    stats = update_stats(res, stats)
    batch, key_idx = prepare_next_batch(res, keys, key_idx, stats)
    if len(batch) == 0:
        print("Stopping, no more project configs to request")
        LIVE = False
    else:
        time.sleep(0.25)
        ipdb.set_trace(context=5)

print()  # Empty line after potential ^C
pprint.pprint(stats)
