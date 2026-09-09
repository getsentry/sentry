"""Shared constants for Autofix PR-iteration features."""

from sentry.integrations.types import IntegrationProviderSlug

# Automated CI iteration: a check suite fails, Seer is asked to fix it.
ITERATION_FLAG = "organizations:autofix-pr-iteration"

# Human-triggered iteration: the drawer feedback form, ``@sentry`` PR comments,
# and PR reviews.
MANUAL_FLAG = "organizations:autofix-pr-iteration-manual"

# Draft-on-create, CI-green undraft, and review-request. Undraft requires
# ``MarkPullRequestDraftStateProtocol`` which is GitHub-only today; other SCM
# providers skip as unsupported until they grow that capability.
REVIEW_REQUEST_FLAG = "organizations:autofix-pr-iteration-review-request"

# Hand the PR to a human once automated iteration has spent its hard cap. Only
# reachable after iteration has already run, so it never starts iteration.
CAP_ASSIGN_FLAG = "organizations:autofix-pr-iteration-cap-assign"

# We should only resolve check suites when certain features are enabled depending on the
# status of the check suite
#
# Failing: automated iteration, the cap assign flag isn't included:
# it modifies the hard cap behaviour which only applies after we know the org
# has iteration enabled
FAILING_CHECK_SUITE_FLAGS = (ITERATION_FLAG, MANUAL_FLAG)

# Green: undraft + review-request, both under one flag -- plus the iteration
# flags, because a green suite also releases feedback parked by an earlier
# failing suite on the same head. That parking happens behind
# ``FAILING_CHECK_SUITE_FLAGS``, so the same orgs must survive the green gate or
# their parked feedback sits out the full deferral instead of starting on green.
# ``green_review_side_effects_enabled`` still holds undraft / review-request to
# ``REVIEW_REQUEST_FLAG`` alone.
GREEN_CHECK_SUITE_FLAGS = (REVIEW_REQUEST_FLAG, *FAILING_CHECK_SUITE_FLAGS)

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
