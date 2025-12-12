from __future__ import annotations

from dataclasses import dataclass

from sentry.notifications.platform.registry import template_registry
from sentry.notifications.platform.templates.types import NotificationTemplateSource
from sentry.notifications.platform.types import (
    BoldTextBlock,
    CodeBlock,
    CodeTextBlock,
    NotificationBodyFormattingBlockType,
    NotificationBodyTextBlockType,
    NotificationCategory,
    NotificationData,
    NotificationRenderedAction,
    NotificationRenderedImage,
    NotificationRenderedTemplate,
    NotificationTemplate,
    ParagraphBlock,
    PlainTextBlock,
)


@dataclass(frozen=True)
class ErrorAlertData(NotificationData):
    source = NotificationTemplateSource.ERROR_ALERT
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
    example_data = ErrorAlertData(
        error_type="ValueError",
        error_message="'NoneType' object has no attribute 'get'",
        project_name="my-app",
        issue_id="12345",
        error_count=15,
        first_seen="2024-01-15 14:30:22 UTC",
        chart_url="https://example.com/chart",
        issue_url="https://example.com/issues",
        assign_url="https://example.com/assign",
    )

    def render(self, data: ErrorAlertData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"{data.error_count} new {data.error_type} errors in {data.project_name}",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="A new",
                        ),
                        CodeTextBlock(
                            type=NotificationBodyTextBlockType.CODE,
                            text=data.error_type,
                        ),
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"error has been detected in {data.project_name} with",
                        ),
                        BoldTextBlock(
                            type=NotificationBodyTextBlockType.BOLD_TEXT,
                            text=f"{data.error_count} occurrences.",
                        ),
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="The error message is:",
                        )
                    ],
                ),
                CodeBlock(
                    type=NotificationBodyFormattingBlockType.CODE_BLOCK,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=data.error_message,
                        ),
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"This error was first seen at {data.first_seen} and requires immediate attention.",
                        )
                    ],
                ),
            ],
            actions=[
                NotificationRenderedAction(label="View Issue", link="https://example.com/issues"),
                NotificationRenderedAction(label="Assign to Me", link="https://example.com/assign"),
            ],
            chart=NotificationRenderedImage(
                url="https://github.com/knobiknows/all-the-bufo/blob/main/all-the-bufo/all-the-bufo.png?raw=true",
                alt_text="Error occurrence chart",
            ),
            footer="This alert was triggered by your error monitoring rules.",
        )


@dataclass(frozen=True)
class DeploymentData(NotificationData):
    source = NotificationTemplateSource.DEPLOYMENT
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

    example_data = DeploymentData(
        project_name="my-app",
        version="v2.1.3",
        environment="production",
        deployer="john.doe@acme.com",
        commit_sha="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
        commit_message="Fix user authentication bug",
        deployment_url="https://example.com/deployment",
        rollback_url="https://example.com/rollback",
    )

    def render(self, data: DeploymentData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"Deployment to {data.environment}: {data.version}",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"Version {data.version} has been successfully deployed to {data.environment} for project {data.project_name}. ",
                        )
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"The deployment was initiated by {data.deployer} with commit {data.commit_sha[:8]}: {data.commit_message}. ",
                        )
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="Monitor the deployment status and be ready to rollback if any issues are detected.",
                        )
                    ],
                ),
            ],
            actions=[
                NotificationRenderedAction(
                    label="View Deployment", link="https://example.com/deployment"
                ),
                NotificationRenderedAction(label="Rollback", link="https://example.com/rollback"),
            ],
            footer="Deployment completed at deployment-service",
        )


@dataclass(frozen=True)
class SlowLoadMetricAlertData(NotificationData):
    source = NotificationTemplateSource.SLOW_LOAD_METRIC_ALERT
    alert_type: str
    severity: str
    project_name: str
    alert_url: str
    acknowledge_url: str
    escalate_url: str
    measurement: str
    threshold: str
    start_time: str
    chart_url: str


@template_registry.register(SlowLoadMetricAlertData.source)
class SlowLoadMetricAlertNotificationTemplate(NotificationTemplate[SlowLoadMetricAlertData]):
    category = NotificationCategory.DEBUG
    example_data = SlowLoadMetricAlertData(
        alert_type="Slow Product Load",
        severity="critical",
        project_name="example-app",
        measurement="5152.0 p50(measurements.lc)",
        threshold="static",
        start_time="2024-01-15 14:30:22 UTC",
        chart_url="https://storage.googleapis.com/sentryio-chartcuterie-bucket/b8c05163a9474cf0ae0c6e8797e768ee.png",
        acknowledge_url="https://example.com/acknowledge",
        escalate_url="https://example.com/escalate",
        alert_url="https://example.com/alert",
    )

    def render(self, data: SlowLoadMetricAlertData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"{data.severity.upper()}: {data.alert_type} in {data.project_name}",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"{data.measurement} since {data.start_time}",
                        )
                    ],
                ),
            ],
            chart=NotificationRenderedImage(
                url=data.chart_url,
                alt_text="Metric alert chart",
            ),
            actions=[
                NotificationRenderedAction(
                    label="Acknowledge", link="https://example.com/acknowledge"
                ),
                NotificationRenderedAction(label="Escalate", link="https://example.com/escalate"),
            ],
            footer=f"Threshold: {data.threshold} | Triggered alert: {data.alert_url}",
        )


@dataclass(frozen=True)
class PerformanceAlertData(NotificationData):
    source = NotificationTemplateSource.PERFORMANCE_MONITORING
    metric_name: str
    threshold: str
    current_value: str
    project_name: str
    chart_url: str
    investigation_url: str


@template_registry.register(PerformanceAlertData.source)
class PerformanceAlertNotificationTemplate(NotificationTemplate[PerformanceAlertData]):
    category = NotificationCategory.DEBUG
    example_data = PerformanceAlertData(
        metric_name="API response time",
        threshold="500ms",
        current_value="1.2s",
        project_name="my-app",
        chart_url="https://example.com/chart",
        investigation_url="https://example.com/investigate",
    )

    def render(self, data: PerformanceAlertData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"Performance Alert: {data.metric_name} threshold exceeded",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"Performance alert triggered for {data.metric_name} in project {data.project_name}. ",
                        )
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"The current value of {data.current_value} exceeds the threshold of {data.threshold}. ",
                        )
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text="Immediate investigation is recommended to identify and resolve the performance degradation.",
                        )
                    ],
                ),
            ],
            actions=[
                NotificationRenderedAction(
                    label="Investigate Performance", link="https://example.com/investigate"
                )
            ],
            chart=NotificationRenderedImage(
                url="https://github.com/knobiknows/all-the-bufo/raw/main/all-the-bufo/buff-bufo.png",
                alt_text="Performance metrics chart",
            ),
        )


@dataclass(frozen=True)
class TeamUpdateData(NotificationData):
    source = NotificationTemplateSource.TEAM_COMMUNICATION
    team_name: str
    update_type: str
    message: str
    author: str
    timestamp: str


@template_registry.register(TeamUpdateData.source)
class TeamUpdateNotificationTemplate(NotificationTemplate[TeamUpdateData]):
    category = NotificationCategory.DEBUG
    example_data = TeamUpdateData(
        team_name="Engineering",
        update_type="Weekly Standup Reminder",
        message="Don't forget about our weekly standup meeting tomorrow at 10 AM. Please prepare your updates on current sprint progress.",
        author="jane.smith@acme.com",
        timestamp="2024-01-15 16:45:00 UTC",
    )

    def render(self, data: TeamUpdateData) -> NotificationRenderedTemplate:
        return NotificationRenderedTemplate(
            subject=f"Team Update: {data.update_type}",
            body=[
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"Team {data.team_name} has posted a {data.update_type} update. ",
                        )
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"Message: {data.message} ",
                        )
                    ],
                ),
                ParagraphBlock(
                    type=NotificationBodyFormattingBlockType.PARAGRAPH,
                    blocks=[
                        PlainTextBlock(
                            type=NotificationBodyTextBlockType.PLAIN_TEXT,
                            text=f"Posted by {data.author} at {data.timestamp}.",
                        )
                    ],
                ),
            ],
            footer="This is an informational update from your team.",
        )
