"""Shared log identity for the automated PR-iteration flow.

The flow spans four entry points that can run minutes or hours apart: a GitHub
``check_suite`` webhook arrives, a task later drains the feedback queue and calls
Seer, Seer calls back when the iteration completes, and the push that follows
calls back again (which can hand straight back to the queue). Debugging one
occurrence means pulling all four back together, so every log line in the flow
carries the same identity block, anchored on the Autofix ``run_id``.

Call sites hand :class:`PrIterationLogContext` what they already have in scope --
the run state, and the organization and group ids -- and it derives the identity
from them::

    ctx = PrIterationLogContext(logger, organization_id=organization_id)
    ...
    ctx.update(run_state=run_state, group_id=group_id)
    ctx.info("autofix.pr_iteration.check_suite.run_resolved", head_sha=head_sha)

Nothing here reads the database. Every source is either an object the caller is
already holding or an id it was handed, so building a context is free no matter
how hot the path is. That is also why the identity is ids rather than slugs: a
``Group`` is never in scope anywhere in this flow, and neither the issue short id
nor the project slug is worth a query per log line. An issue link carries the
group id, so ``sentry_group_id`` is enough to pivot from -- find the ``run_id``
on any line that has both, then grep the ``run_id`` across all four sections.

Identity *accumulates*: each :meth:`~PrIterationLogContext.update` fills in what
is now knowable and never erases what an earlier one established. The check-suite
listener starts with almost nothing -- a webhook is just a webhook until Seer says
which run owns the PR -- and gains the rest the moment the run resolves.

A run can open a PR in more than one repo, so the SCM half of the identity is a
*list*: :data:`PrIterationIdentity.scm_infos` projects the run's ``repo_pr_states``
whole, rather than naming one repo picked arbitrarily.

Per-line data -- what this particular check suite concluded, what was sitting in
the queue -- is passed to the emit methods as free-form keyword arguments and is
deliberately *not* part of the schema. The rule of thumb for what to record: log
the inputs the code reads, not the conclusions it derives from them. Given the
inputs, a human with database and Redis access can re-run the logic by hand.

Log names are passed in full and literal (``ctx.info("autofix.pr_iteration.
check_suite.received")``) rather than assembled from parts, so a name seen in
production can be grepped for directly in this repo.
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from sentry.seer.agent.client_models import SeerRunState


class PrIterationScmInfo(TypedDict, total=False):
    """One repo of a run, and the pull request the run opened in it.

    Invariant is that we only have a single PR per repo per run, so we don't have to
    worry about the case where we have multiple PRs in the same repo for a given run.

    Only what is stable for the life of the PR belongs here. The run's recorded
    head commit does not: it moves with every push, and a line that reports a sha
    should report the one it actually compared, as a per-line field.
    """

    scm_provider: str  # for now this is always expected to be GitHub

    scm_repo_full_name: str  # ``owner/repo``

    pr_id: int
    pr_number: int
    pr_url: str


class PrIterationIdentity(TypedDict, total=False):
    """Stable, human-readable identity for one PR iteration.

    This is the *emitted* shape -- what lands in the log ``extra``. Call sites
    never build it; they hand :class:`PrIterationLogContext` the sources it is
    derived from.

    Every key is optional. Key names match the sibling ``seer/code_review`` webhook
    handlers so the two Seer-adjacent flows are searchable the same way.
    """

    # The stable id: what ties the four sections of one iteration together.
    run_id: int

    sentry_organization_id: int
    sentry_group_id: int

    # One entry per repo the run opened a PR in.
    scm_infos: list[PrIterationScmInfo]


class PrIterationLogContext:
    """Derives identity from what it is handed, and emits log lines with it.

    Sources are objects the caller already holds or ids it was already given --
    never something this class goes and fetches. Breaking a source down into the
    fields worth logging is our job; having the source in hand is the caller's.

    Identity goes into the log ``extra`` only -- deliberately not onto the Sentry
    scope, which would attach it to every span in the request as well.
    """

    def __init__(
        self,
        logger: logging.Logger,
        *,
        run_state: SeerRunState | None = None,
        organization_id: int | None = None,
        group_id: int | None = None,
    ) -> None:
        self._logger = logger
        self._identity: PrIterationIdentity = {}
        self.update(
            run_state=run_state,
            organization_id=organization_id,
            group_id=group_id,
        )

    def update(
        self,
        *,
        # Carries the run id, and names every repo the run opened a PR in.
        run_state: SeerRunState | None = None,
        organization_id: int | None = None,
        group_id: int | None = None,
    ) -> None:
        """Hand over whatever is now in scope. Omitted sources change nothing."""
        identity: PrIterationIdentity = {}

        if organization_id is not None:
            identity["sentry_organization_id"] = organization_id

        if group_id is not None:
            identity["sentry_group_id"] = group_id

        if run_state is not None:
            identity["run_id"] = run_state.run_id
            # Left alone when the run has no PRs yet, so an update that carries no
            # run state can't erase a list an earlier one set.
            if scm_infos := _scm_infos(run_state):
                identity["scm_infos"] = scm_infos

        self._identity.update(identity)

    @property
    def identity(self) -> PrIterationIdentity:
        return self._identity.copy()

    def info(self, name: str, **fields: Any) -> None:
        """Record that we are doing, or have done, a piece of work."""
        self._logger.info(name, extra={**self._identity, **fields})

    def error(self, name: str, *, exc_info: bool = True, **fields: Any) -> None:
        """Record an *unexpected* failure. Pass ``exc_info=False`` outside a handler.

        Error rather than warning because the level is the search key: finding
        every broken iteration should be one query for errors under
        ``autofix.pr_iteration``, not a list of names someone has to know in
        advance.
        """
        self._logger.error(name, extra={**self._identity, **fields}, exc_info=exc_info)


def _scm_infos(run_state: SeerRunState) -> list[PrIterationScmInfo]:
    """One entry per repo the run opened a PR in, straight off ``repo_pr_states``."""
    infos: list[PrIterationScmInfo] = []
    for repo_full_name, pr_state in run_state.repo_pr_states.items():
        info: PrIterationScmInfo = {"scm_repo_full_name": repo_full_name}
        if pr_state.provider is not None:
            info["scm_provider"] = pr_state.provider
        if pr_state.pr_id is not None:
            info["pr_id"] = pr_state.pr_id
        if pr_state.pr_number is not None:
            info["pr_number"] = pr_state.pr_number
        if pr_state.pr_url is not None:
            info["pr_url"] = pr_state.pr_url
        infos.append(info)
    return infos
