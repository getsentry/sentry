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
            subject=f"{data.error_count} new {data.error_type} errors in {data.project_name}",
            body=(
                f"A new {data.error_type} error has been detected in {data.project_name} with {data.error_count} occurrences. "
                f"The error message is: {data.error_message}. "
                f"This error was first seen at {data.first_seen} and requires immediate attention."
            ),
            actions=[
                NotificationRenderedAction(label="View Issue", link="https://example.com/issues"),
                NotificationRenderedAction(label="Assign to Me", link="https://example.com/assign"),
            ],
            chart=NotificationRenderedImage(
                url="https://example.com/chart", alt_text="Error occurrence chart"
            ),
            footer="This alert was triggered by your error monitoring rules.",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="15 new ValueError errors in my-app",
            body=(
                "A new ValueError error has been detected in my-app with 15 occurrences. "
                "The error message is: 'NoneType' object has no attribute 'get'. "
                "This error was first seen at 2024-01-15 14:30:22 UTC and requires immediate attention."
            ),
            actions=[
                NotificationRenderedAction(label="View Issue", link="https://example.com/issues"),
                NotificationRenderedAction(
                    label="Assign to Me",
                    link="https://example.com/assign",
                ),
            ],
            chart=NotificationRenderedImage(
                url="https://example.com/chart",
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
            subject=f"Deployment to {data.environment}: {data.version}",
            body=(
                f"Version {data.version} has been successfully deployed to {data.environment} for project {data.project_name}. "
                f"The deployment was initiated by {data.deployer} with commit {data.commit_sha[:8]}: {data.commit_message}. "
                f"Monitor the deployment status and be ready to rollback if any issues are detected."
            ),
            actions=[
                NotificationRenderedAction(
                    label="View Deployment", link="https://example.com/deployment"
                ),
                NotificationRenderedAction(label="Rollback", link="https://example.com/rollback"),
            ],
            footer="Deployment completed at deployment-service",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Deployment to production: v2.1.3",
            body=(
                "Version v2.1.3 has been successfully deployed to production for project my-app. "
                "The deployment was initiated by john.doe@acme.com with commit a1b2c3d4: Fix user authentication bug. "
                "Monitor the deployment status and be ready to rollback if any issues are detected."
            ),
            actions=[
                NotificationRenderedAction(
                    label="View Deployment",
                    link="https://example.com/deployment",
                ),
                NotificationRenderedAction(
                    label="Rollback",
                    link="https://example.com/rollback",
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
        return NotificationRenderedTemplate(
            subject=f"SECURITY ALERT: {data.alert_type} in {data.project_name}",
            body=(
                f"A {data.severity.upper()} security alert of type {data.alert_type} has been triggered for project {data.project_name}. "
                f"The alert description: {data.description}. "
                f"This security incident has affected {data.affected_users} users and requires immediate investigation and response."
            ),
            actions=[
                NotificationRenderedAction(
                    label="View Alert Details", link="https://example.com/security-alert"
                ),
                NotificationRenderedAction(
                    label="Acknowledge", link="https://example.com/acknowledge"
                ),
                NotificationRenderedAction(
                    label="Escalate to Security Team", link="https://example.com/escalate"
                ),
            ],
            footer="This is a security alert requiring immediate attention.",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="SECURITY ALERT: Suspicious login pattern in my-app",
            body=(
                "A CRITICAL security alert of type Suspicious login pattern has been triggered for project my-app. "
                "The alert description: Multiple failed login attempts detected from unusual locations. "
                "This security incident has affected 23 users and requires immediate investigation and response."
            ),
            actions=[
                NotificationRenderedAction(
                    label="View Alert Details",
                    link="https://example.com/security-alert",
                ),
                NotificationRenderedAction(
                    label="Acknowledge",
                    link="https://example.com/acknowledge",
                ),
                NotificationRenderedAction(
                    label="Escalate to Security Team",
                    link="https://example.com/escalate",
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
            subject=f"Performance Alert: {data.metric_name} threshold exceeded",
            body=(
                f"Performance alert triggered for {data.metric_name} in project {data.project_name}. "
                f"The current value of {data.current_value} exceeds the threshold of {data.threshold}. "
                f"Immediate investigation is recommended to identify and resolve the performance degradation."
            ),
            actions=[
                NotificationRenderedAction(
                    label="Investigate Performance", link="https://example.com/investigate"
                )
            ],
            chart=NotificationRenderedImage(
                url="https://example.com/chart", alt_text="Performance metrics chart"
            ),
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Performance Alert: API response time threshold exceeded",
            body=(
                "Performance alert triggered for API response time in project my-app. "
                "The current value of 1.2s exceeds the threshold of 500ms. "
                "Immediate investigation is recommended to identify and resolve the performance degradation."
            ),
            actions=[
                NotificationRenderedAction(
                    label="Investigate Performance",
                    link="https://example.com/investigate",
                )
            ],
            chart=NotificationRenderedImage(
                url="https://example.com/chart",
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
            subject=f"Team Update: {data.update_type}",
            body=(
                f"Team {data.team_name} has posted a {data.update_type} update. "
                f"Message: {data.message} "
                f"Posted by {data.author} at {data.timestamp}."
            ),
            footer="This is an informational update from your team.",
        )

    def render_example(self) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject="Team Update: Weekly Standup Reminder",
            body=(
                "Team Engineering has posted a Weekly Standup Reminder update. "
                "Message: Don't forget about our weekly standup meeting tomorrow at 10 AM. Please prepare your updates on current sprint progress. "
                "Posted by jane.smith@acme.com at 2024-01-15 16:45:00 UTC."
            ),
            footer="This is an informational update from your team.",
        )
