from random import random

from sentry import options
from sentry.models.organization import Organization


def apply_streamline_rollout_group(organization: Organization) -> None:
    # This shouldn't run multiple times, but if it does, don't re-sort the organization.
    # If they're already in the experiment, we ignore them.
    if organization.get_option("sentry:streamline_ui_only") is not None:
        return

    rollout_rate = options.get("issues.details.streamline-experiment-rollout-rate")

    # If the random number is less than the rollout_rate, the organization is in the experiment.
    if random() <= rollout_rate:
        split_rate = options.get("issues.details.streamline-experiment-split-rate")
        # If the random number is less than the split_rate, the split_result is true.
        split_result = random() <= split_rate
        # When split_result is true, they only receive the Streamline UI.
        # When split_result is false, they only receive the Legacy UI.
        # This behaviour is controlled on the frontend.
        organization.update_option("sentry:streamline_ui_only", split_result)
