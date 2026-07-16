from __future__ import annotations

import re

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedIntegerField, FlexibleForeignKey, cell_silo_model
from sentry.db.models.base import DefaultFieldsModel
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey

ORGANIZATION_CONTRIBUTOR_ACTIVATION_THRESHOLD = 2

# GitLab auto-generates bot and service-account usernames with these reserved
# prefixes. Unlike GitHub bots (whose login ends in "[bot]"), GitLab bots carry
# no "[bot]" suffix and the merge_request webhook payload exposes no bot flag, so
# we detect them from the username persisted in ``alias``:
#   - project access token bots: ``project_{project_id}_bot_{random}``
#   - group access token bots:   ``group_{group_id}_bot_{random}``
#   - service accounts:          ``service_account_{random}`` /
#                                ``service_account_group_{group_id}_{random}``
# GitHub usernames cannot contain underscores, so these patterns never collide
# with a real GitHub login.
#
# Known gap (intentional): GitLab < 16.0 named access-token bots with a numeric
# counter and no random suffix -- ``project_{id}_bot`` / ``project_{id}_bot2`` /
# ``group_{id}_bot2`` -- which lack the trailing ``_`` this pattern requires and
# so are NOT matched. We only support the >= 16.0 ``_bot_{random}`` format:
# service accounts (the other prefix) did not exist until 16.1, and the legacy
# window (self-managed instances on 13.0-15.11 that are also on Seer GitLab
# code review) is narrow enough that we accept miscounting those bots as human
# rather than loosen the boundary. See SCM-121 for the broader alias caveats.
GITLAB_BOT_USERNAME_RE = re.compile(r"^(project_\d+_bot_|group_\d+_bot_|service_account_)")


@cell_silo_model
class OrganizationContributors(DefaultFieldsModel):
    """
    Tracks external contributors and their activity for an organization.
    This model stores information about contributors associated with an
    integration for a specific organization, including their external identity
    and how many actions they have taken.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization = FlexibleForeignKey("sentry.Organization", on_delete=models.CASCADE)

    integration_id = HybridCloudForeignKey("sentry.Integration", on_delete="DO_NOTHING")

    external_identifier = models.CharField(max_length=255, db_index=True)
    provider = models.CharField(max_length=64)
    # Disambiguate external identifiers for self-hosted instances.
    hostname = models.CharField(max_length=255)

    alias = models.CharField(max_length=255, null=True, blank=True)
    num_actions = BoundedIntegerField(default=0)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationcontributors"
        constraints = [
            models.UniqueConstraint(
                fields=["organization_id", "integration_id", "external_identifier"],
                name="sentry_orgcont_unique_org_cont",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization_id", "date_updated"],
                name="sentry_oc_org_date_upd_idx",
            ),
        ]

    @property
    def is_bot(self) -> bool:
        """
        Check if the contributor is a bot.

        - GitHub bots have a ``[bot]`` suffix (e.g. ``dependabot[bot]``); Copilot
          is a special case without the suffix.
        - GitLab bots and service accounts have no suffix or webhook bot flag, so
          we match GitLab's reserved username prefixes (see
          ``GITLAB_BOT_USERNAME_RE``).
        """
        return self.alias is not None and (
            self.alias.endswith("[bot]")
            or self.alias == "Copilot"
            or GITLAB_BOT_USERNAME_RE.match(self.alias) is not None
        )


@cell_silo_model
class OrganizationContributorAction(DefaultFieldsModel):
    """
    Append-only record of a contributor's billable action: one row per pull request, written the
    first time that PR is opened. Used to count and display a contributor's actions for a billing
    period.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization_contributor = FlexibleForeignKey(
        "sentry.OrganizationContributors", on_delete=models.CASCADE
    )
    # Ensure a durable PR identity by disabling cascade deletion.
    repository = FlexibleForeignKey(
        "sentry.Repository", on_delete=models.DO_NOTHING, db_constraint=False
    )
    pr_number = models.CharField(max_length=64)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationcontributoraction"
        constraints = [
            models.UniqueConstraint(
                fields=["repository_id", "pr_number"], name="sentry_orgcontaction_unique_pr"
            )
        ]
        indexes = [
            models.Index(
                fields=["organization_contributor", "date_added"],
                name="sentry_orgcontaction_date",
            )
        ]
