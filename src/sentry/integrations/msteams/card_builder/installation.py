from sentry.integrations.msteams.card_builder import AdaptiveCard, ColumnSetBlock
from sentry.models import Organization
from sentry.utils.http import absolute_uri

from .base import MSTeamsMessageBuilder
from .block import (
    ActionType,
    ColumnWidth,
    TextSize,
    TextWeight,
    VerticalContentAlignment,
    create_action_block,
    create_column_block,
    create_column_set_block,
    create_logo_block,
    create_text_block,
)
from .utils import InstallationMessages


def create_title_block(text: str) -> ColumnSetBlock:
    return create_column_set_block(
        create_logo_block(),
        create_column_block(
            create_text_block(text, size=TextSize.LARGE, weight=TextWeight.BOLDER),
            width=ColumnWidth.STRECH,
            verticalContentAlignment=VerticalContentAlignment.CENTER,
        ),
    )


def build_welcome_card(signed_params: str) -> AdaptiveCard:
    url = absolute_uri(
        InstallationMessages.MSTEAMS_CONFIGURE_URL.format(signed_params=signed_params)
    )

    return MSTeamsMessageBuilder().build(
        title=create_title_block(InstallationMessages.TEAM_INSTALLTION_TITLE),
        text=InstallationMessages.TEAM_INSTALLATION_DESCRIPTION,
        fields=[InstallationMessages.TEAM_INSTALLATION_INSTRUCTION],
        actions=[
            create_action_block(
                ActionType.OPEN_URL,
                title=InstallationMessages.TEAM_INSTALLATION_BUTTON,
                url=url,
            )
        ],
    )


def build_personal_installation_message() -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        title=create_title_block(InstallationMessages.PERSONAL_INSTALLATION_TITLE),
        text=InstallationMessages.PERSONAL_INSTALLATION_INSTRUCTION,
    )


def build_installation_confirmation_message(organization: Organization) -> AdaptiveCard:
    alert_rule_url = absolute_uri(
        InstallationMessages.ALERT_RULE_URL.format(organization_slug=organization.slug)
    )
    return MSTeamsMessageBuilder().build(
        title=create_title_block(
            InstallationMessages.INSTALLATION_CONFIRMATION_TITLE.format(
                organization_name=organization.name
            )
        ),
        text=InstallationMessages.INSTALLATION_CONFIRMATION_INSTRUCTION,
        actions=[
            create_action_block(
                ActionType.OPEN_URL,
                title=InstallationMessages.INSTALLATION_CONFIRMATION_BUTTON,
                url=alert_rule_url,
            )
        ],
    )
