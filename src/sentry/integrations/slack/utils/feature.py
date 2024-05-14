import logging

from sentry.models.integrations.integration import Integration
from sentry.services.hybrid_cloud.integration import RpcIntegration

_default_logger = logging.getLogger(__name__)


def organization_integration_has_feature_enabled(
    integration: Integration | RpcIntegration, organization_id: int, feature: str
) -> bool:
    """
    Helper function to check if an integration's installation has a specific feature flag
    """
    from sentry.integrations.slack.integration import SlackIntegration

    base_logs = {
        "organization_id": organization_id,
        "integration_id": integration.id,
    }
    installation = integration.get_installation(organization_id=organization_id)
    if installation is None:
        _default_logger.info(
            "no installation found for integration",
            extra=base_logs,
        )
        return False

    if not isinstance(installation, SlackIntegration):
        _default_logger.info(
            "installation object is not a slack integration",
            extra=base_logs,
        )
        return False

    return installation.has_feature(feature_name=feature)


def organization_integration_has_metric_alerts_flag_enabled(
    integration: Integration | RpcIntegration, organization_id: int
) -> bool:
    from sentry.integrations.slack.integration import SlackIntegration

    return organization_integration_has_feature_enabled(
        integration=integration,
        organization_id=organization_id,
        feature=SlackIntegration.METRIC_ALERTS_THREAD_FLAG,
    )


def organization_integration_has_issue_alerts_flag_enabled(
    integration: Integration | RpcIntegration, organization_id: int
) -> bool:
    from sentry.integrations.slack.integration import SlackIntegration

    return organization_integration_has_feature_enabled(
        integration=integration,
        organization_id=organization_id,
        feature=SlackIntegration.ISSUE_ALERTS_THREAD_FLAG,
    )
