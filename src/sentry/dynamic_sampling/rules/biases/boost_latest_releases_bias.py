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
    RESERVED_IDS,
    PolymorphicRule,
    RuleType,
    eval_dynamic_factor,
)


class BoostLatestReleasesDataProvider(BiasDataProvider):
    def get_bias_data(self, bias_params: BiasParams) -> BiasData:
        return {
            "id": RESERVED_IDS[RuleType.BOOST_LATEST_RELEASES_RULE],
            "factor": eval_dynamic_factor(bias_params.base_sample_rate, 1.5),
            "boostedReleases": ProjectBoostedReleases(
                bias_params.project.id
            ).get_extended_boosted_releases(),
        }


class BoostLatestReleasesRulesGeneratorV2(BiasRulesGenerator):
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
                    "decayingFn": {
                        "type": "linear",
                        "decayedValue": 1.0,
                    },
                }
                for idx, boosted_release in enumerate(boosted_releases)
            ],
        )


class BoostLatestReleasesBiasV2(Bias):
    def __init__(self) -> None:
        super().__init__(BoostLatestReleasesDataProvider, BoostLatestReleasesRulesGeneratorV2)
