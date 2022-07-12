from typing import Any

from sentry.models import Organization
from sentry.utils.http import absolute_uri

from .base import (
    ActionType,
    ColumnWidth,
    MSTeamsMessageBuilder,
    TextSize,
    TextWeight,
    VerticalContentAlignment,
)
from .utils import InstallationMessages


class MSTeamsInstallationTitleMessageBuilder(MSTeamsMessageBuilder):
    def get_title_block(self, text: str) -> Any:
        return self.create_column_set_block(
            self.create_logo_block(),
            self.create_column_block(
                self.create_text_block(text, size=TextSize.LARGE, weight=TextWeight.BOLDER),
                width=ColumnWidth.STRECH,
                verticalContentAlignment=VerticalContentAlignment.CENTER,
            ),
        )


class MSTeamsTeamInstallationMessageBuilder(MSTeamsInstallationTitleMessageBuilder):
    def __init__(self, signed_params: str):
        self.url = InstallationMessages.MSTEAMS_CONFIGURE_URL.format(signed_params=signed_params)

    def build(self) -> Any:
        return self.build_card(
            title=self.get_title_block(InstallationMessages.TEAM_INSTALLTION_TITLE),
            text=InstallationMessages.TEAM_INSTALLATION_DESCRIPTION,
            fields=[InstallationMessages.TEAM_INSTALLATION_INSTRUCTION],
            actions=[
                self.create_action_block(
                    ActionType.OPEN_URL,
                    title=InstallationMessages.TEAM_INSTALLATION_BUTTON,
                    url=self.url,
                )
            ],
        )


class MSTeamsPersonalIntallationMessageBuilder(MSTeamsInstallationTitleMessageBuilder):
    def build(self) -> Any:
        return self.build_card(
            title=self.get_title_block(InstallationMessages.PERSONAL_INSTALLATION_TITLE),
            text=InstallationMessages.PERSONAL_INSTALLATION_INSTRUCTION,
        )


class MSTeamsInstallationConfirmationMessageBuilder(MSTeamsInstallationTitleMessageBuilder):
    def __init__(self, organization: Organization):
        self.organization = organization

    def build(self) -> Any:
        alert_rule_url = absolute_uri(
            InstallationMessages.ALERT_RULE_URL.format(organization_slug=self.organization.slug)
        )
        return self.build_card(
            title=self.get_title_block(
                InstallationMessages.INSTALLATION_CONFIRMATION_TITLE.format(
                    organization_name=self.organization.name
                )
            ),
            text=InstallationMessages.INSTALLATION_CONFIRMATION_INSTRUCTION,
            actions=[
                self.create_action_block(
                    ActionType.OPEN_URL,
                    title=InstallationMessages.INSTALLATION_CONFIRMATION_BUTTON,
                    url=alert_rule_url,
                )
            ],
        )
