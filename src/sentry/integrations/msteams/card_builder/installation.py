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


def build_installation_card(signed_params: str, title: str, description: str, instruction: str):
    url = absolute_uri(
        InstallationMessages.MSTEAMS_CONFIGURE_URL.format(signed_params=signed_params)
    )

    return MSTeamsMessageBuilder().build(
        title=create_title_block(title),
        text=description,
        fields=[instruction],
        actions=[
            create_action_block(
                ActionType.OPEN_URL,
                title=InstallationMessages.TEAM_INSTALLATION_BUTTON,
                url=url,
            )
        ],
    )


def build_team_installation_message(signed_params: str) -> AdaptiveCard:
    return build_installation_card(
        signed_params=signed_params,
        title=InstallationMessages.TEAM_INSTALLTION_TITLE,
        description=InstallationMessages.TEAM_INSTALLATION_DESCRIPTION,
        instruction=InstallationMessages.TEAM_INSTALLATION_INSTRUCTION,
    )


def build_personal_installation_message(signed_params: str) -> AdaptiveCard:
    return build_installation_card(
        signed_params=signed_params,
        title=InstallationMessages.PERSONAL_INSTALLATION_TITLE,
        description=InstallationMessages.PERSONAL_INSTALLATION_DESCRIPTION,
        instruction=InstallationMessages.PERSONAL_INSTALLATION_INSTRUCTION,
    )


def build_installation_confirmation_message(
    title: str, text: str, button_title: str, url: str
) -> AdaptiveCard:
    return MSTeamsMessageBuilder().build(
        title=create_title_block(title),
        text=text,
        actions=[create_action_block(ActionType.OPEN_URL, title=button_title, url=url)],
    )


def build_team_installation_confirmation_message(organization: Organization) -> AdaptiveCard:
    alert_rule_url = absolute_uri(
        InstallationMessages.ALERT_RULE_URL.format(organization_slug=organization.slug)
    )

    return build_installation_confirmation_message(
        title=InstallationMessages.TEAM_INSTALLATION_CONFIRMATION_TITLE.format(
            organization_name=organization.name
        ),
        text=InstallationMessages.TEAM_INSTALLATION_CONFIRMATION_INSTRUCTION,
        button_title=InstallationMessages.TEAM_INSTALLATION_CONFIRMATION_BUTTON,
        url=alert_rule_url,
    )


def build_personal_installation_confirmation_message() -> AdaptiveCard:
    notification_settings_url = absolute_uri(InstallationMessages.NOTIFICATION_SETTINGS_URL)

    return build_installation_confirmation_message(
        title=InstallationMessages.PERSONAL_INSTALLATION_CONFIRMATION_TITLE,
        text=InstallationMessages.PERSONAL_INSTALLATION_CONFIRMATION_INSTRUCTION,
        button_title=InstallationMessages.PERSONAL_INSTALLATION_CONFIRMATION_BUTTON,
        url=notification_settings_url,
    )
