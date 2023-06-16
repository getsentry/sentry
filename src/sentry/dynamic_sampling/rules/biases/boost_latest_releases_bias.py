from datetime import datetime
from typing import List, cast

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.helpers.latest_releases import ProjectBoostedReleases
from sentry.dynamic_sampling.rules.utils import (
    LATEST_RELEASES_BOOST_DECAYED_FACTOR,
    LATEST_RELEASES_BOOST_FACTOR,
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    apply_dynamic_factor,
)
from sentry.models import Project


class BoostLatestReleasesBias(Bias):

    datetime_format = "%Y-%m-%dT%H:%M:%SZ"

    def generate_rules(self, project: Project, base_sample_rate: float) -> List[PolymorphicRule]:
        factor = apply_dynamic_factor(base_sample_rate, LATEST_RELEASES_BOOST_FACTOR)
        boosted_releases = ProjectBoostedReleases(project.id).get_extended_boosted_releases()

        return cast(
            List[PolymorphicRule],
            [
                {
                    "samplingValue": {
                        "type": "factor",
                        "value": factor,
                    },
                    "type": "trace",
                    "condition": {
                        "op": "and",
                        "inner": [
                            {
                                "op": "eq",
                                "name": "trace.release",
                                "value": [boosted_release.version],
                            },
                            {
                                "op": "eq",
                                "name": "trace.environment",
                                # When environment is None, it will be mapped to equivalent null in json.
                                # When Relay receives a rule with "value": null it will match it against events without
                                # the environment tag set.
                                "value": boosted_release.environment,
                            },
                        ],
                    },
                    "id": RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE] + idx,
                    "timeRange": {
                        "start": datetime.utcfromtimestamp(boosted_release.timestamp).strftime(
                            self.datetime_format
                        ),
                        "end": datetime.utcfromtimestamp(
                            boosted_release.timestamp + boosted_release.platform.time_to_adoption
                        ).strftime(self.datetime_format),
                    },
                    "decayingFn": {
                        "type": "linear",
                        "decayedValue": LATEST_RELEASES_BOOST_DECAYED_FACTOR,
                    },
                }
                for idx, boosted_release in enumerate(boosted_releases)
            ],
        )
