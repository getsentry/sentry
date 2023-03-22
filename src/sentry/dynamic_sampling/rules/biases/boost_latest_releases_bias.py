from datetime import datetime
from typing import List, cast

from sentry.dynamic_sampling.rules.biases.base import (
    Bias,
    BiasData,
    BiasDataProvider,
    BiasParams,
    BiasRulesGenerator,
)
from sentry.dynamic_sampling.rules.helpers.latest_releases import ProjectBoostedReleases
from sentry.dynamic_sampling.rules.utils import (
    LATEST_RELEASES_BOOST_DECAYED_FACTOR,
    LATEST_RELEASES_BOOST_FACTOR,
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    apply_dynamic_factor,
)


class BoostLatestReleasesDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE],
            "factor": apply_dynamic_factor(
                bias_params.base_sample_rate, LATEST_RELEASES_BOOST_FACTOR
            ),
            "decayedFactor": LATEST_RELEASES_BOOST_DECAYED_FACTOR,
            "boostedReleases": ProjectBoostedReleases(
                bias_params.project.id
            ).get_extended_boosted_releases(),
        }


class BoostLatestReleasesRulesGenerator(BiasRulesGenerator):

    datetime_format = "%Y-%m-%dT%H:%M:%SZ"

    def _generate_bias_rules(self, bias_data: BiasData) -> List[PolymorphicRule]:
        boosted_releases = bias_data["boostedReleases"]

        return cast(
            List[PolymorphicRule],
            [
                {
                    "samplingValue": {
                        "type": "factor",
                        "value": bias_data["factor"],
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
                    "id": bias_data["id"] + idx,
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
                        "decayedValue": bias_data["decayedFactor"],
                    },
                }
                for idx, boosted_release in enumerate(boosted_releases)
            ],
        )


class BoostLatestReleasesBias(Bias):
    def __init__(self) -> None:
        super().__init__(BoostLatestReleasesDataProvider, BoostLatestReleasesRulesGenerator)
