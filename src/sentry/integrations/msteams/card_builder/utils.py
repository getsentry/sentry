class HelpMessages:
    HELP_TITLE = "Please use one of the following commands for Sentry:"
    HELP_MESSAGE = (
        "- **link**: link your Microsoft Teams identity to your Sentry account"
        "\n\n- **unlink**: unlink your Microsoft Teams identity from your Sentry account"
        "\n\n- **help**: view list of all bot commands"
    )

    UNRECOGNIZED_COMMAND = "Sorry, I didn't understand '{command_text}'."
    AVAILABLE_COMMANDS_TEXT = "Type **help**: to see the list of available commands"

    MENTIONED_TITLE = (
        "Sentry for Microsoft Teams does not support any commands in channels, only in direct messages."
        " To unlink your Microsoft Teams identity from your Sentry account message the personal bot."
    )
    MENTIONED_TEXT = (
        "Want to learn more about configuring alerts in Sentry? Check out our documentation."
    )
    DOCS_BUTTON = "Docs"
    DOCS_URL = "https://docs.sentry.io/product/alerts-notifications/alerts/"


class IdentityMessages:
    LINK_IDENTITY_BUTTON = "Link Identities"
    LINK_IDENTITY = "You need to link your Microsoft Teams account to your Sentry account before you can take action through Teams messages. Please click here to do so."

    LINK_COMMAND_MESSAGE = "Your Microsoft Teams identity will be linked to your Sentry account when you interact with alerts from Sentry."

    IDENTITY_LINKED = (
        "Your Microsoft Teams identity has been linked to your Sentry account. You're good to go."
    )

    ALREADY_LINKED = "Your Microsoft Teams identity is already linked to a Sentry account."

    UNLINK_IDENTITY_BUTTON = "Unlink Identity"
    UNLINK_IDENTITY = "Click below to unlink your identity"

    IDENTITY_UNLINKED = "Your Microsoft Teams identity has been unlinked to your Sentry account. You will need to re-link if you want to interact with messages again."


class InstallationMessages:
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
