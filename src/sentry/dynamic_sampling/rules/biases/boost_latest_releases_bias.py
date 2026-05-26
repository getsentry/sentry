from datetime import datetime
from typing import cast

from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.helpers.latest_releases import ProjectBoostedReleases
from sentry.dynamic_sampling.rules.utils import (
    LATEST_RELEASES_BOOST_DECAYED_FACTOR,
    LATEST_RELEASES_BOOST_FACTOR,
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
)
from sentry.models.project import Project


class BoostLatestReleasesBias(Bias):
    datetime_format = "%Y-%m-%dT%H:%M:%SZ"

    def generate_rules(self, project: Project, base_sample_rate: float) -> list[PolymorphicRule]:
        # If the base sample rate is 100%, the factor will be 1.0
        # If the base sample rate is close to 0%, the factor will be 1.5
        # Between these two extremes, the factor will be a decaying value between 1.0 and 1.5
        # Why is it quadratic? I don't know, legacy code.
        factor = float(LATEST_RELEASES_BOOST_FACTOR ** (1 - base_sample_rate))
        boosted_releases = ProjectBoostedReleases(project).get_extended_boosted_releases()

        return cast(
            list[PolymorphicRule],
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
                        "start": datetime.fromtimestamp(boosted_release.timestamp).strftime(
                            self.datetime_format
                        ),
                        "end": datetime.fromtimestamp(
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
