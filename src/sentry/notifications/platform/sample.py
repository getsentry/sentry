from __future__ import annotations

from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.types import (
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedImage,
    NotificationRenderedTemplate,
    NotificationTemplate,
)


@dataclass(frozen=True)
class ErrorAlertData(NotificationData):
    source = "error-alert-service"
    error_type: str
    error_message: str
    project_name: str
    issue_id: str
    error_count: int
    first_seen: str
    chart_url: str
    issue_url: str
    assign_url: str


@template_registry.register(ErrorAlertData.source)
class ErrorAlertNotificationTemplate(NotificationTemplate[ErrorAlertData]):
    category = NotificationCategory.DEBUG

    def render(self, data: ErrorAlertData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"🚨 {data.error_count} new {data.error_type} errors in {data.project_name}",
            body=(
                f"Error: {data.error_message}\n"
                f"Project: {data.project_name}\n"
                f"First seen: {data.first_seen}\n"
                f"Total occurrences: {data.error_count}"
            ),
            actions=[
                NotificationRenderedAction(label="View Issue", link=data.issue_url),
                NotificationRenderedAction(label="Assign to Me", link=data.assign_url),
            ],
            chart=NotificationRenderedImage(url=data.chart_url, alt_text="Error occurrence chart"),
            footer="This alert was triggered by your error monitoring rules.",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="🚨 15 new ValueError errors in my-app",
            body=(
                "Error: 'NoneType' object has no attribute 'get'\n"
                "Project: my-app\n"
                "First seen: 2024-01-15 14:30:22 UTC\n"
                "Total occurrences: 15"
            ),
            actions=[
                NotificationRenderedAction(
                    label="View Issue", link="https://sentry.io/organizations/acme/issues/12345/"
                ),
                NotificationRenderedAction(
                    label="Assign to Me",
                    link="https://sentry.io/organizations/acme/issues/12345/assign/",
                ),
            ],
            chart=NotificationRenderedImage(
                url="https://sentry.io/api/0/projects/acme/my-app/issues/12345/chart/",
                alt_text="Error occurrence chart",
            ),
            footer="This alert was triggered by your error monitoring rules.",
        )


@dataclass(frozen=True)
class DeploymentData(NotificationData):
    source = "deployment-service"
    project_name: str
    version: str
    environment: str
    deployer: str
    commit_sha: str
    commit_message: str
    deployment_url: str
    rollback_url: str


@template_registry.register(DeploymentData.source)
class DeploymentNotificationTemplate(NotificationTemplate[DeploymentData]):
    category = NotificationCategory.DEBUG

    def render(self, data: DeploymentData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"🚀 Deployment to {data.environment}: {data.version}",
            body=(
                f"Project: {data.project_name}\n"
                f"Version: {data.version}\n"
                f"Environment: {data.environment}\n"
                f"Deployed by: {data.deployer}\n"
                f"Commit: {data.commit_sha[:8]} - {data.commit_message}"
            ),
            actions=[
                NotificationRenderedAction(label="View Deployment", link=data.deployment_url),
                NotificationRenderedAction(label="Rollback", link=data.rollback_url),
            ],
            footer="Deployment completed at deployment-service",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="🚀 Deployment to production: v2.1.3",
            body=(
                "Project: my-app\n"
                "Version: v2.1.3\n"
                "Environment: production\n"
                "Deployed by: john.doe@acme.com\n"
                "Commit: a1b2c3d4 - Fix user authentication bug"
            ),
            actions=[
                NotificationRenderedAction(
                    label="View Deployment",
                    link="https://sentry.io/organizations/acme/releases/v2.1.3/",
                ),
                NotificationRenderedAction(
                    label="Rollback",
                    link="https://sentry.io/organizations/acme/releases/v2.1.3/rollback/",
                ),
            ],
            footer="Deployment completed at deployment-service",
        )


@dataclass(frozen=True)
class SecurityAlertData(NotificationData):
    source = "security-monitoring"
    alert_type: str
    severity: str
    project_name: str
    description: str
    affected_users: int
    alert_url: str
    acknowledge_url: str
    escalate_url: str


@template_registry.register(SecurityAlertData.source)
class SecurityAlertNotificationTemplate(NotificationTemplate[SecurityAlertData]):
    category = NotificationCategory.DEBUG

    def render(self, data: SecurityAlertData) -> NotificationRenderedTemplate:
        severity_emoji = (
            "🔴" if data.severity == "critical" else "🟡" if data.severity == "high" else "🟢"
        )

        return NotificationRenderedTemplate(
            subject=f"{severity_emoji} SECURITY ALERT: {data.alert_type} in {data.project_name}",
            body=(
                f"Alert Type: {data.alert_type}\n"
                f"Severity: {data.severity.upper()}\n"
                f"Project: {data.project_name}\n"
                f"Description: {data.description}\n"
                f"Affected Users: {data.affected_users}"
            ),
            actions=[
                NotificationRenderedAction(label="View Alert Details", link=data.alert_url),
                NotificationRenderedAction(label="Acknowledge", link=data.acknowledge_url),
                NotificationRenderedAction(
                    label="Escalate to Security Team", link=data.escalate_url
                ),
            ],
            footer="This is a security alert requiring immediate attention.",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="🔴 SECURITY ALERT: Suspicious login pattern in my-app",
            body=(
                "Alert Type: Suspicious login pattern\n"
                "Severity: CRITICAL\n"
                "Project: my-app\n"
                "Description: Multiple failed login attempts detected from unusual locations\n"
                "Affected Users: 23"
            ),
            actions=[
                NotificationRenderedAction(
                    label="View Alert Details",
                    link="https://sentry.io/organizations/acme/alerts/security/12345/",
                ),
                NotificationRenderedAction(
                    label="Acknowledge",
                    link="https://sentry.io/organizations/acme/alerts/security/12345/acknowledge/",
                ),
                NotificationRenderedAction(
                    label="Escalate to Security Team",
                    link="https://sentry.io/organizations/acme/alerts/security/12345/escalate/",
                ),
            ],
            footer="This is a security alert requiring immediate attention.",
        )


@dataclass(frozen=True)
class PerformanceAlertData(NotificationData):
    source = "performance-monitoring"
    metric_name: str
    threshold: str
    current_value: str
    project_name: str
    chart_url: str
    investigation_url: str


@template_registry.register(PerformanceAlertData.source)
class PerformanceAlertNotificationTemplate(NotificationTemplate[PerformanceAlertData]):
    category = NotificationCategory.DEBUG

    def render(self, data: PerformanceAlertData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"⚡ Performance Alert: {data.metric_name} threshold exceeded",
            body=(
                f"Metric: {data.metric_name}\n"
                f"Threshold: {data.threshold}\n"
                f"Current Value: {data.current_value}\n"
                f"Project: {data.project_name}"
            ),
            actions=[
                NotificationRenderedAction(
                    label="Investigate Performance", link=data.investigation_url
                )
            ],
            chart=NotificationRenderedImage(
                url=data.chart_url, alt_text="Performance metrics chart"
            ),
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="⚡ Performance Alert: API response time threshold exceeded",
            body=(
                "Metric: API response time\n"
                "Threshold: 500ms\n"
                "Current Value: 1.2s\n"
                "Project: my-app"
            ),
            actions=[
                NotificationRenderedAction(
                    label="Investigate Performance",
                    link="https://sentry.io/organizations/acme/performance/summary/?project=12345",
                )
            ],
            chart=NotificationRenderedImage(
                url="https://sentry.io/api/0/projects/acme/my-app/performance/chart/",
                alt_text="Performance metrics chart",
            ),
        )


@dataclass(frozen=True)
class TeamUpdateData(NotificationData):
    source = "team-communication"
    team_name: str
    update_type: str
    message: str
    author: str
    timestamp: str


@template_registry.register(TeamUpdateData.source)
class TeamUpdateNotificationTemplate(NotificationTemplate[TeamUpdateData]):
    category = NotificationCategory.DEBUG

    def render(self, data: TeamUpdateData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"📢 Team Update: {data.update_type}",
            body=(
                f"Team: {data.team_name}\n"
                f"Update: {data.update_type}\n"
                f"Message: {data.message}\n"
                f"Posted by: {data.author}\n"
                f"Time: {data.timestamp}"
            ),
            footer="This is an informational update from your team.",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="📢 Team Update: Weekly Standup Reminder",
            body=(
                "Team: Engineering\n"
                "Update: Weekly Standup Reminder\n"
                "Message: Don't forget about our weekly standup meeting tomorrow at 10 AM. Please prepare your updates on current sprint progress.\n"
                "Posted by: jane.smith@acme.com\n"
                "Time: 2024-01-15 16:45:00 UTC"
            ),
            footer="This is an informational update from your team.",
        )
