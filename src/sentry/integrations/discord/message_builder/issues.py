from __future__ import annotations

from sentry import features, tagstore
from sentry.eventstore.models import GroupEvent
from sentry.integrations.discord.message_builder import LEVEL_TO_COLOR
from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
from sentry.integrations.discord.message_builder.base.component.action_row import DiscordActionRow
from sentry.integrations.discord.message_builder.base.component.base import DiscordMessageComponent
from sentry.integrations.discord.message_builder.base.component.button import DiscordButton
from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
from sentry.integrations.discord.message_builder.base.embed.field import DiscordMessageEmbedField
from sentry.integrations.discord.message_builder.base.embed.footer import DiscordMessageEmbedFooter
from sentry.integrations.messaging.message_builder import (
    build_attachment_text,
    build_attachment_title,
    build_footer,
    get_color,
    get_title_link,
    get_title_link_workflow_engine_ui,
)
from sentry.integrations.types import ExternalProviders
from sentry.models.group import Group, GroupStatus
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.notifications.notifications.base import ProjectNotification
from sentry.notifications.utils.rules import get_key_from_rule_data

from ..message_builder.base.component import DiscordComponentCustomIds as CustomIds


class DiscordIssuesMessageBuilder(DiscordMessageBuilder):
    def __init__(
        self,
        group: Group,
        event: GroupEvent | None = None,
        tags: set[str] | None = None,
        rules: list[Rule] | None = None,
        link_to_event: bool = False,
        issue_details: bool = False,
        notification: ProjectNotification | None = None,
    ) -> None:
        self.group = group
        self.event = event
        self.tags = tags
        self.rules = rules
        self.link_to_event = link_to_event
        self.issue_details = issue_details
        self.notification = notification

    def build(self, notification_uuid: str | None = None) -> dict[str, object]:
        project = Project.objects.get_from_cache(id=self.group.project_id)
        event_for_tags = self.event or self.group.get_latest_event()
        timestamp = (
            max(self.group.last_seen, self.event.datetime) if self.event else self.group.last_seen
        )
        obj: Group | GroupEvent = self.event if self.event is not None else self.group
        rule_id = None
        rule_environment_id = None
        if self.rules:
            rule_environment_id = self.rules[0].environment_id
            if features.has("organizations:workflow-engine-ui-links", self.group.organization):
                rule_id = int(get_key_from_rule_data(self.rules[0], "workflow_id"))
            elif features.has(
                "organizations:workflow-engine-trigger-actions", self.group.organization
            ):
                rule_id = int(get_key_from_rule_data(self.rules[0], "legacy_rule_id"))
            else:
                rule_id = self.rules[0].id

        url = None

        if features.has("organizations:workflow-engine-ui-links", self.group.organization):
            url = get_title_link_workflow_engine_ui(
                self.group,
                self.event,
                self.link_to_event,
                self.issue_details,
                self.notification,
                ExternalProviders.DISCORD,
                rule_id,
                rule_environment_id,
                notification_uuid=notification_uuid,
            )
        else:
            url = get_title_link(
                self.group,
                self.event,
                self.link_to_event,
                self.issue_details,
                self.notification,
                ExternalProviders.DISCORD,
                rule_id,
                rule_environment_id,
                notification_uuid=notification_uuid,
            )

        embeds = [
            DiscordMessageEmbed(
                title=build_attachment_title(obj),
                description=build_attachment_text(self.group, self.event) or None,
                url=url,
                color=LEVEL_TO_COLOR[get_color(event_for_tags, self.notification, self.group)],
                # We can't embed urls in Discord embed footers.
                footer=DiscordMessageEmbedFooter(
                    build_footer(
                        group=self.group,
                        project=project,
                        url_format="{text}",
                        rules=self.rules,
                    )
                ),
                fields=build_tag_fields(event_for_tags, self.tags),
                timestamp=timestamp,
            )
        ]

        components = build_components(self.group, project)

        return self._build(embeds=embeds, components=components)


def build_tag_fields(
    event_for_tags: GroupEvent | None, tags: set[str] | None = None
) -> list[DiscordMessageEmbedField]:
    fields: list[DiscordMessageEmbedField] = []
    if tags:
        event_tags = event_for_tags.tags if event_for_tags else []
        for key, value in event_tags:
            std_key = tagstore.backend.get_standardized_key(key)
            if std_key not in tags:
                continue

            labeled_value = tagstore.backend.get_tag_value_label(key, value)
            fields.append(
                DiscordMessageEmbedField(
                    std_key,
                    labeled_value,
                    inline=True,
                )
            )
    return fields


def build_components(
    group: Group,
    project: Project,
) -> list[DiscordMessageComponent]:

    archive_button = DiscordButton(
        custom_id=f"{CustomIds.ARCHIVE}:{group.id}",
        label="Archive",
    )

    resolve_button = DiscordButton(
        custom_id=f"{CustomIds.RESOLVE_DIALOG}:{group.id}", label="Resolve..."
    )

    assign_button = DiscordButton(
        custom_id=f"{CustomIds.ASSIGN_DIALOG}:{group.id}", label="Assign..."
    )

    status = group.get_status()

    if not project.flags.has_releases:
        resolve_button = DiscordButton(
            custom_id=f"{CustomIds.RESOLVE}:{group.id}",
            label="Resolve",
        )

    if status == GroupStatus.RESOLVED:
        resolve_button = DiscordButton(
            custom_id=f"{CustomIds.UNRESOLVE}:{group.id}",
            label="Unresolve",
        )

    if status == GroupStatus.IGNORED:
        archive_button = DiscordButton(
            custom_id=f"{CustomIds.MARK_ONGOING}:{group.id}",
            label="Mark as Ongoing",
        )

    return [
        DiscordActionRow(components=[resolve_button, archive_button, assign_button]),
    ]
