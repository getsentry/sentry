from typing import Any

from sentry.utils.http import absolute_uri

from .base.base import (
    ActionType,
    ColumnWidth,
    MSTeamsMessageBuilder,
    TextSize,
    TextWeight,
    VerticalContentAlignment,
)

MSTEAMS_CONFIGURE_URL = "/extensions/msteams/configure/?signed_params={signed_params}"
TEAM_INSTALLTION_TITLE = "Welcome to Sentry for Microsoft Teams"
TEAM_INSTALLATION_DESCRIPTION = "You can use Sentry for Microsoft Teams to get notifications that allow you to assign, ignore, or resolve directly in your chat."
TEAM_INSTALLATION_INSTRUCTION = (
    "Please click **Complete Setup** to finish the setup process."
    " Don't have a Sentry account? [Sign Up](https://sentry.io/signup/)."
)
TEAM_INSTALLATION_BUTTON = "Complete Setup"

PERSONAL_INSTALLATION_TITLE = "Personal Installation of Sentry"
PERSONAL_INSTALLATION_INSTRUCTION = (
    "It looks like you have installed Sentry as a personal app."
    " Sentry for Microsoft Teams needs to be added to a team. Please add"
    ' Sentry again, and select "Add to a team" from the "Add" button\'s list arrow'
)

INSTALLATION_CONFIRMATION_TITLE = "Installation for {organization_name} is successful"
INSTALLATION_CONFIRMATION_INSTRUCTION = (
    "Now that setup is complete, you can continue by configuring alerts."
)
INSTALLATION_CONFIRMATION_BUTTON = "Add Alert Rules"
ALERT_RULE_URL = "organizations/{organization_slug}/alerts/rules/"


class MSTeamsInstallationTitleMessageBuilder(MSTeamsMessageBuilder):
    def get_title_block(self, text: str) -> Any:
        return self.get_column_set_block(
            self.get_column_block(self.get_logo_block()),
            self.get_column_block(
                self.get_text_block(text, size=TextSize.LARGE, weight=TextWeight.BOLDER),
                width=ColumnWidth.STRECH,
                verticalContentAlignment=VerticalContentAlignment.CENTER,
            ),
        )


class MSTeamsTeamInstallationMessageBuilder(MSTeamsInstallationTitleMessageBuilder):
    def __init__(self, signed_params: str):
        self.url = MSTEAMS_CONFIGURE_URL.format(signed_params=signed_params)

    def build(self):
        return self._build(
            title=self.get_title_block(TEAM_INSTALLTION_TITLE),
            text=self.get_text_block(TEAM_INSTALLATION_DESCRIPTION),
            fields=[self.get_text_block(TEAM_INSTALLATION_INSTRUCTION)],
            actions=[
                self.get_action_block(ActionType.OPEN_URL, TEAM_INSTALLATION_BUTTON, url=self.url)
            ],
        )


class MSTeamsPersonalIntallationMessageBuilder(MSTeamsInstallationTitleMessageBuilder):
    def build(self):
        return self._build(
            title=self.get_title_block(PERSONAL_INSTALLATION_TITLE),
            text=self.get_text_block(PERSONAL_INSTALLATION_INSTRUCTION),
        )


class MSTeamsInstallationConfirmationMessageBuilder(MSTeamsInstallationTitleMessageBuilder):
    def __init__(self, organization):
        self.organization = organization

    def build(self):
        alert_rule_url = absolute_uri(
            ALERT_RULE_URL.format(organization_slug=self.organization.slug)
        )
        return self._build(
            title=self.get_title_block(
                INSTALLATION_CONFIRMATION_TITLE.format(organization_name=self.organization.name)
            ),
            text=self.get_text_block(INSTALLATION_CONFIRMATION_INSTRUCTION),
            actions=[
                self.get_action_block(
                    ActionType.OPEN_URL, INSTALLATION_CONFIRMATION_BUTTON, url=alert_rule_url
                )
            ],
        )
