from sentry.models.organization import Organization
from sentry.utils.options import sample_modulo


def apply_streamline_rollout_group(organization: Organization):
    # If unset, the organization's users can opt-in/out.
    if organization.get_option("sentry:streamline_ui_only") is not None:
        return

    # If the experiment is not enabled, the organization's users can opt-in/out.
    rollout_result = sample_modulo(
        "issues.details.streamline-experiment-rollout-rate", organization.id
    )

    if rollout_result:
        split_result = sample_modulo(
            "issues.details.streamline-experiment-split-rate", organization.id
        )
        # If split_result is true, they only receive the Streamline UI.
        # If split_result is false, they only receive the Legacy UI.
        # This behaviour is controlled on the frontend.
        organization.update_option("sentry:streamline_ui_only", split_result)
