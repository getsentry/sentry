from sentry.dynamic_sampling.rules.biases.base import Bias
from sentry.dynamic_sampling.rules.utils import RESERVED_IDS, PolymorphicRule, RuleType
from sentry.dynamic_sampling.tasks.helpers.recalibrate_orgs import (
    get_adjusted_factor,
    get_adjusted_project_factor,
)
from sentry.dynamic_sampling.utils import is_project_mode_sampling
from sentry.models.project import Project


class RecalibrationBias(Bias):
    """
    Correction bias that tries to bring the overall sampling rate for the organisation to the
    desired sampling rate.

    Various biases boost and shrink different transactions in order to obtain an appropriate
    number of samples from all areas of the application, doing this changes the overall sampling
    rate from the desired sampling rate, this bias tries to rectify the overall organisation sampling
    rate and bring it to the desired sampling rate,it uses the previous interval rate to figure out
    how this should be done.
    """

    def generate_rules(self, project: Project, base_sample_rate: float) -> list[PolymorphicRule]:
        if is_project_mode_sampling(project.organization):
            adjusted_factor = get_adjusted_project_factor(project.id)
        else:
            adjusted_factor = get_adjusted_factor(project.organization.id)

        # We don't want to generate any rule in case the factor is 1.0 since we should multiply the factor and 1.0
        # is the identity of the multiplication.
        if adjusted_factor == 1.0:
            return []

        return [
            {
                "samplingValue": {"type": "factor", "value": adjusted_factor},
                "type": "trace",
                "condition": {
                    "op": "and",
                    "inner": [],
                },
                "id": RESERVED_IDS[RuleType.RECALIBRATION_RULE],
            }
        ]
