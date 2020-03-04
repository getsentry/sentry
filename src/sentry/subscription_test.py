from __future__ import absolute_import

import random
from datetime import timedelta
from itertools import combinations

from sentry.models.project import Project
from sentry.snuba.models import QueryAggregations, QueryDatasets, QuerySubscription
from sentry.snuba.subscriptions import create_snuba_subscription, delete_snuba_subscription
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

queries = ["level:error", "user.email:dfuller@sentry.io", "ConnectTimeout"]
all_queries = [""]
for i in range(1, len(queries) + 1):
    all_queries.extend([" ".join(combo) for combo in combinations(queries, i)])
aggregations = [QueryAggregations.TOTAL, QueryAggregations.UNIQUE_USERS]
time_windows = [
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=10),
    timedelta(minutes=15),
    timedelta(minutes=30),
    timedelta(minutes=60),
    timedelta(minutes=120),
    timedelta(minutes=240),
    timedelta(days=1),
]
# This isn't associated with any callbacks, so won't actually fire alert rules. Makes
# it easy to identify these fake subs.
FAKE_SUBSCRIPTION_TYPE = "load_test"


def create_fake_subscriptions(
    number_to_create, organization_slug="sentry", project_slug="sentry", seed=None
):
    random.seed(seed)
    project = Project.objects.get(organization__slug=organization_slug, slug=project_slug)
    for _ in range(number_to_create):
        create_snuba_subscription(
            project,
            FAKE_SUBSCRIPTION_TYPE,
            QueryDatasets.EVENTS,
            random.choice(all_queries),
            random.choice(aggregations),
            time_window=random.choice(time_windows),
            resolution=timedelta(minutes=1),
            environment_names=None,
        )


def delete_fake_subscriptions():
    for subscription in RangeQuerySetWrapperWithProgressBar(
        QuerySubscription.objects.filter(type=FAKE_SUBSCRIPTION_TYPE)
    ):
        delete_snuba_subscription(subscription)
