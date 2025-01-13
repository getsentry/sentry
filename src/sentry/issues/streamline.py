from sentry.models.organization import Organization
from sentry.utils.options import sample_modulo


def apply_streamline_rollout_group(organization: Organization):
    # If unset, the organization's users can opt-in/out.
    if organization.get_option("sentry:streamline_ui_only") is not None:
        return

    result = sample_modulo("issues.details.streamline_rollout_rate", organization.id)
    # If result is true, they only receive the Streamline UI.
    # If result is false, they only receive the Legacy UI.
    # This behaviour is controlled on the frontend.
    organization.update_option("sentry:streamline_ui_only", result)
