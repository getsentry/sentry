from __future__ import annotations

from dataclasses import replace

from django.template.defaultfilters import pluralize
from slack_sdk.models.blocks import Block, MarkdownTextObject, SectionBlock

from sentry.notifications.platform.registry import renderer_registry
from sentry.notifications.platform.slack.provider import SlackRenderable, SlackRenderer
from sentry.notifications.platform.templates.deploy import (
    NO_COMMITS_TEXT,
    DeployReleaseData,
    build_deploy_commit_line,
    build_deploy_project_line,
    build_deploy_summary,
)
from sentry.notifications.platform.tracking import NotificationLinkDecorator
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSource,
    NotificationTextBlock,
)

MAX_LISTED_PROJECTS = 10
MAX_LISTED_COMMITS_PER_REPO = 10
# Room left in a section for the "…and N more" line.
OVERFLOW_LINE_ROOM = 50


@renderer_registry.register(
    NotificationProviderKey.SLACK, sources=[NotificationSource.DEPLOY_RELEASE]
)
class SlackDeployReleaseRenderer(SlackRenderer):
    """
    Lists each repo's commits, and the projects, in one section each instead of a block per line,
    and caps each list, so large releases fit within Slack's block limit and say what was cut.
    """

    @classmethod
    def render[DataT: NotificationData](
        cls,
        *,
        data: DataT,
        rendered_template: NotificationRenderedTemplate,
        link_decorator: NotificationLinkDecorator,
    ) -> SlackRenderable:
        if not isinstance(data, DeployReleaseData):
            raise ValueError(
                f"SlackDeployReleaseRenderer does not support {data.__class__.__name__}"
            )

        def render_line(blocks: list[NotificationTextBlock]) -> str:
            return cls._render_text_blocks(
                [
                    replace(block, url=link_decorator.decorate_url(block.url))
                    if isinstance(block, LinkTextBlock)
                    else block
                    for block in blocks
                ]
            )

        body_blocks: list[Block] = cls._render_body(build_deploy_summary(data))
        if data.release_projects:
            body_blocks.append(
                cls._render_list(
                    heading="*Projects:*",
                    lines=[
                        render_line(build_deploy_project_line(rp))
                        for rp in data.release_projects[:MAX_LISTED_PROJECTS]
                    ],
                    total=len(data.release_projects),
                    noun="project",
                )
            )
        if data.repo_name_to_commits:
            body_blocks.append(SectionBlock(text=MarkdownTextObject(text="*Repositories:*")))
            for repo_name, commits in data.repo_name_to_commits.items():
                body_blocks.append(
                    cls._render_list(
                        heading=f"*{repo_name}*",
                        lines=[
                            render_line(build_deploy_commit_line(commit))
                            for commit in commits[:MAX_LISTED_COMMITS_PER_REPO]
                        ],
                        total=len(commits),
                        noun="commit",
                    )
                )
        else:
            body_blocks.append(SectionBlock(text=MarkdownTextObject(text=f"_{NO_COMMITS_TEXT}_")))

        return cls._render_message(
            rendered_template=link_decorator.decorate_rendered_template(rendered_template),
            body_blocks=body_blocks,
        )

    @classmethod
    def _render_list(cls, *, heading: str, lines: list[str], total: int, noun: str) -> SectionBlock:
        shown: list[str] = []
        length = len(heading)
        for line in lines:
            length += len(line) + 1
            if length > SectionBlock.text_max_length - OVERFLOW_LINE_ROOM:
                break
            shown.append(line)
        text = "\n".join([heading, *shown])
        if omitted := total - len(shown):
            text += f"\n_…and {omitted} more {noun}{pluralize(omitted)}_"
        return SectionBlock(text=MarkdownTextObject(text=text))
