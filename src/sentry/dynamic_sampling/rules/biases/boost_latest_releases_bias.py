from datetime import datetime
from typing import List, cast

from pytz import UTC

from sentry.dynamic_sampling.rules.biases.base import (
    Bias,
    BiasData,
    BiasDataProvider,
    BiasParams,
    BiasRulesGenerator,
)
from sentry.dynamic_sampling.rules.helpers.latest_releases import ProjectBoostedReleases
from sentry.dynamic_sampling.rules.utils import (
    RELEASE_BOOST_FACTOR,
    RESERVED_IDS,
    BaseRule,
    RuleType,
)


class BoostLatestReleasesDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE],
            "baseSampleRate": bias_params.base_sample_rate,
            "sampleRate": min(1.0, bias_params.base_sample_rate * RELEASE_BOOST_FACTOR),
            "boostedReleases": ProjectBoostedReleases(
                bias_params.project.id
            ).get_extended_boosted_releases(),
        }


class BoostLatestReleasesRulesGenerator(BiasRulesGenerator):
    def _generate_bias_rules(self, bias_data: BiasData) -> List[BaseRule]:
        boosted_releases = bias_data["boostedReleases"]

        return cast(
            List[BaseRule],
            [
                {
                    "sampleRate": bias_data["sampleRate"],
                    "type": "trace",
                    "active": True,
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
                    "id": bias_data["id"] + idx,
                    "timeRange": {
                        "start": str(
                            datetime.utcfromtimestamp(boosted_release.timestamp).replace(tzinfo=UTC)
                        ),
                        "end": str(
                            datetime.utcfromtimestamp(
                                boosted_release.timestamp
                                + boosted_release.platform.time_to_adoption
                            ).replace(tzinfo=UTC)
                        ),
                    },
                    # We want to use the linear decaying function for latest release boosting, with the goal
                    # of interpolating the adoption growth with the reduction in sample rate.
                    "decayingFn": {
                        "type": "linear",
                        "decayedSampleRate": bias_data["baseSampleRate"],
                    },
                }
                for idx, boosted_release in enumerate(boosted_releases)
            ],
        )


class BoostLatestReleasesBias(Bias):
    def __init__(self) -> None:
        super().__init__(BoostLatestReleasesDataProvider, BoostLatestReleasesRulesGenerator)
