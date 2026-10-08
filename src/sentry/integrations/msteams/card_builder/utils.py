class HelpMessages:
    HELP_TITLE = "Please use one of the following commands for Sentry:"
    HELP_MESSAGE = (
        "- **link**: link your Microsoft Teams identity to your Sentry account"
        "\n\n- **unlink**: unlink your Microsoft Teams identity from your Sentry account"
        "\n\n- **help**: view list of all bot commands"
    )

    UNRECOGNIZED_COMMAND = "Sorry, I didn't understand '{command_text}'."
    AVAILABLE_COMMANDS_TEXT = "Type **help**: to see the list of available commands"

    MENTIONED_TITLE = "Sentry is already installed for this team."
    MENTIONED_TEXT = (
        "Microsoft Teams installs Sentry once per team. To receive alerts in this channel, add a "
        "MS Teams action to an alert, select the '{team_name}' team and enter this channel's name."
        "\n\n To unlink your Microsoft Teams identity from your Sentry account, message the personal bot."
    )
    MANAGE_BUTTON = "Installation"
    ALERT_BUTTON = "Alerts"

    MISSING_INSTALLATION_TITLE = "Sentry installation is incomplete for this team."
    MISSING_INSTALLATION_TEXT = (
        "We couldn't find a Sentry integration for this team. Follow the Microsoft Teams setup "
        "guide to reconnect it."
    )
    MISSING_INSTALLATION_BUTTON = "View Guide"
    MISSING_INSTALLATION_URL = "https://docs.sentry.io/integrations/notification-incidents/msteams/"


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
        " Please click **Complete Setup** below to link your Microsoft Teams identity"
        " with Sentry and start receiving notifications in this space."
        " Don't have a Sentry account? [Sign Up](https://sentry.io/signup/)."
    )
    PERSONAL_INSTALLATION_DESCRIPTION = (
        "It looks like you have installed Sentry as a personal app."
        " Sentry for Microsoft Teams can also be added to a team. To do that, add"
        ' Sentry again, select "Add to a team" from the "Add" button\'s list arrow.'
    )

    TEAM_INSTALLATION_CONFIRMATION_TITLE = "Installation for {organization_name} is successful"
    TEAM_INSTALLATION_CONFIRMATION_INSTRUCTION = (
        "Now that setup is complete, you can continue by configuring alerts."
    )
    TEAM_INSTALLATION_CONFIRMATION_BUTTON = "Add Monitors"
    MONITORS_URL = "organizations/{organization_slug}/monitors/"

    PERSONAL_INSTALLATION_CONFIRMATION_TITLE = "Personal installation successful"
    PERSONAL_INSTALLATION_CONFIRMATION_INSTRUCTION = (
        "Now that setup is complete, you can configure and fine tune your notification settings."
    )
    PERSONAL_INSTALLATION_CONFIRMATION_BUTTON = "Notification Settings"
    NOTIFICATION_SETTINGS_URL = "/settings/account/notifications/"


class IssueConstants:
    # NOTE: DATE and TIME are formatting functions in Adaptive Cards.
    # The syntax is `{{DATE(<some_date>, SHORT)}}` or `{{TIME(<some_date>)}}`
    # https://docs.microsoft.com/en-us/adaptive-cards/authoring-cards/text-features
    # Since `{` and `}` are special characters in format strings, we need to use
    # double `{{` and `}}` to get the actual character in. Hence the `{{{{` and `}}}}`.
    DATE_FORMAT = "{{{{DATE({date}, SHORT)}}}} at {{{{TIME({date})}}}}"

    ASSIGNEE_NOTE = "**Assigned to {assignee}**"

    RESOLVE = "Resolve"
    RESOLVE_INPUT_ID = "resolveInput"
    RESOLVE_INPUT_CHOICES = [
        ("Immediately", "resolved"),
        ("In the current release", "resolved:inCurrentRelease"),
        ("In the next release", "resolved:inNextRelease"),
    ]

    UNRESOLVE = "Unresolve"

    ARCHIVE = "Archive"
    ARCHIVE_INPUT_ID = "archiveInput"
    ARCHIVE_INPUT_TITLE = "Archive until this happens again..."
    ARCHIVE_INPUT_CHOICES = [
        ("Archive forever", "-1"),
        ("1 time", "1"),
        ("10 times", "10"),
        ("100 times", "100"),
        ("1,000 times", "1000"),
        ("10,000 times", "10000"),
    ]
    UNARCHIVE = "Unarchive"

    ASSIGN = "Assign"
    ASSIGN_INPUT_TITLE = "Assign to..."
    ASSIGN_INPUT_ID = "assignInput"

    UNASSIGN = "Unassign"


translator = str.maketrans({"&": "&amp;", "<": "&lt;", ">": "&gt;", "_": "\\_"})


def escape_markdown_special_chars(text: str) -> str:
    """
    Convert markdown special characters to markdown friendly alternatives.
    docs - https://docs.microsoft.com/en-us/adaptive-cards/authoring-cards/text-features
    """
    return text.translate(translator)
