"""Shared constants for Autofix PR-iteration features."""

from sentry.integrations.types import IntegrationProviderSlug

# Draft-on-create, CI-green undraft, and review-request. Undraft requires
# ``MarkPullRequestDraftStateProtocol`` which is GitHub-only today; other SCM
# providers skip as unsupported until they grow that capability.
REVIEW_REQUEST_FLAG = "organizations:autofix-pr-iteration-review-request"

# The only SCM provider PR iteration supports.
#
# GitHub Enterprise (``github_enterprise``) is explicitly NOT supported, and is
# excluded on purpose rather than by omission. Note the contrast with
# ``sentry.seer.autofix.constants.SEER_GITHUB_PROVIDERS``, which deliberately
# *does* include GHE: Autofix at large runs on GHE, PR iteration does not. A GHE
# repo therefore reaches these entry points, and — being GitHub-shaped — would
# pass every other provider check and be handled as if it were github.com. It is
# left out because PR iteration has never been exercised against a GHE instance:
# there is no longer one to test against, and the team decided not to block on
# standing one back up. Nothing here is known to be broken on GHE; it is simply
# unverified, so it stays off.
#
# Re-enabling means more than adding the provider string: audit everything that
# assumes a single github.com host. Repo external ids are the usual trap — they
# are unique per GitHub instance, not globally, so anything keyed on one alone
# (caches especially) collides across a GHE install and github.com.
#
# The slug is what the SCM event stream and ``Integration.provider`` carry, and
# is where the entry points turn GHE away — before any repo lookup. The prefixed
# form is ``Repository.provider``, used for repo queries and for the provider
# string Seer is keyed on.
PR_ITERATION_PROVIDER_SLUG = IntegrationProviderSlug.GITHUB.value
PR_ITERATION_PROVIDER = f"integrations:{PR_ITERATION_PROVIDER_SLUG}"
