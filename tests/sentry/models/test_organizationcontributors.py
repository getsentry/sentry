import pytest

from sentry.models.organizationcontributors import OrganizationContributors

# ``is_bot`` only reads ``self.alias``, so an unsaved in-memory instance is
# enough — no organization, integration, or database row required.
BOT_ALIASES = [
    # GitHub-style bots (existing behavior).
    "dependabot[bot]",
    "renovate[bot]",
    "Copilot",
    # GitLab project / group access token bots.
    "project_278964_bot_a1b2c3d4",
    "group_123_bot_4ffca233d8298ea1",
    # GitLab service accounts (instance- and group-scoped).
    "service_account_6018816a18e515214e0c34c2b33523fc",
    "service_account_group_345_6018816a18e515214e0c34c2b33523fc",
]

NON_BOT_ALIASES = [
    # Regular humans on either provider.
    "agarcia",
    "root",
    "octocat",
    # Names that merely resemble the GitLab bot prefixes but do not match the
    # reserved pattern (no numeric id, or no trailing "_bot_").
    "project_manager",
    "group_lead",
    "service_accountant",
    "my_project_42_bot_thing",
    # Known gap (intentional): pre-16.0 GitLab named access-token bots with a
    # numeric counter and no random suffix, so they lack the trailing "_bot_"
    # the pattern requires. We deliberately do not match these -- see the note
    # on GITLAB_BOT_USERNAME_RE -- so they are asserted as non-bots to pin that
    # current behavior. If legacy support is ever added, move these to
    # BOT_ALIASES.
    "project_123_bot",
    "project_123_bot2",
    "group_109_bot2",
    # A null alias must never be treated as a bot.
    None,
]


@pytest.mark.parametrize("alias", BOT_ALIASES)
def test_is_bot_true(alias: str) -> None:
    assert OrganizationContributors(alias=alias).is_bot is True


@pytest.mark.parametrize("alias", NON_BOT_ALIASES)
def test_is_bot_false(alias: str | None) -> None:
    assert OrganizationContributors(alias=alias).is_bot is False
