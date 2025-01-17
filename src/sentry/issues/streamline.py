from random import random

from sentry import options
from sentry.models.organization import Organization


def apply_streamline_rollout_group(organization: Organization):
    # This shouldn't run multiple times, but if it does, don't resort the organization.
    if organization.get_option("sentry:streamline_ui_only") is not None:
        return

    rollout_rate = options.get("issues.details.streamline-experiment-rollout-rate")

    # If the rollout_rate is greater than a random number, the organization is in the experiment.
    if rollout_rate > random():
        split_rate = options.get("issues.details.streamline-experiment-split-rate")
        # If the split_rate is greater than a random number, the split_result is true..
        split_result = split_rate > random()
        # When split_result is true, they only receive the Streamline UI.
        # When split_result is false, they only receive the Legacy UI.
        # This behaviour is controlled on the frontend.
        organization.update_option("sentry:streamline_ui_only", split_result)
