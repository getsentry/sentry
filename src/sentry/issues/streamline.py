from sentry.models.organization import Organization
from sentry.utils.options import sample_modulo


def apply_streamline_rollout_group(organization: Organization):
    # If the rollout_result is false, the organization is not in the experiment.
    rollout_result = sample_modulo(
        "issues.details.streamline-experiment-rollout-rate", organization.id
    )

    if rollout_result:
        # If split_result is true, they only receive the Streamline UI.
        # If split_result is false, they only receive the Legacy UI.
        # This behaviour is controlled on the frontend.
        split_result = sample_modulo(
            "issues.details.streamline-experiment-split-rate", organization.id
        )
        organization.update_option("sentry:streamline_ui_only", split_result)
