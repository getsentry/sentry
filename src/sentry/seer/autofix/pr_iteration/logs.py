"""Shared log identity for the automated PR-iteration flow.

The flow spans four entry points
1. check_suite webhook
2. queue drain calls Seer
3. Seer completion callback
4. Push callback

we include the run_id in every log line to trace through all logs for that run

    ctx = PrIterationLogContext(
        logger, run_state=run_state, organization_id=organization_id, group_id=group_id
    )
    ctx.info("autofix.pr_iteration.check_suite.run_resolved", head_sha=head_sha)

Nothing here reads the database, so a context is free on any hot path.
Per-line data is passed to the emit methods as free-form keywords and is not part of the schema
Log names are passed full and literal so production names grep directly here.
"""

from __future__ import annotations

import logging
from typing import Any, TypedDict

from sentry.seer.agent.client_models import SeerRunState


class PrIterationScmInfo(TypedDict, total=False):
    """One repo of a run and the PR it opened there (one PR per repo per run).

    Only what is stable for the life of the PR belongs here -- not the head sha,
    which moves with every push and is a per-line field.
    """

    scm_provider: str  # for now this is always expected to be GitHub

    scm_repo_full_name: str  # ``owner/repo``

    pr_id: int
    pr_number: int
    pr_url: str


class PrIterationIdentity(TypedDict, total=False):
    """The emitted identity shape -- what lands in the log ``extra``.

    Call sites never build it; they hand :class:`PrIterationLogContext` the
    sources. Every key is optional; names match the sibling ``seer/code_review``
    webhook handlers so both Seer-adjacent flows are searchable the same way.
    """

    # The stable id: what ties the four sections of one iteration together.
    run_id: int

    sentry_organization_id: int
    sentry_group_id: int

    # One entry per repo the run opened a PR in.
    scm_infos: list[PrIterationScmInfo]


class PrIterationLogContext:
    """Derives identity from what it is handed, and emits log lines with it.

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
        identity: PrIterationIdentity = {}
        if organization_id is not None:
            identity["sentry_organization_id"] = organization_id
        if group_id is not None:
            identity["sentry_group_id"] = group_id
        if run_state is not None:
            identity["run_id"] = run_state.run_id
            if scm_infos := _scm_infos(run_state):
                identity["scm_infos"] = scm_infos
        self._identity = identity

    @classmethod
    def for_run(
        cls,
        logger: logging.Logger,
        run_state: SeerRunState,
        organization_id: int,
        group_id: int | None,
    ) -> PrIterationLogContext:
        """Full identity for a run whose state, org, and group are all in hand."""
        return cls(logger, run_state=run_state, organization_id=organization_id, group_id=group_id)

    @property
    def identity(self) -> PrIterationIdentity:
        return self._identity.copy()

    def info(self, name: str, **fields: Any) -> None:
        """Record that we are doing, or have done, a piece of work."""
        self._logger.info(name, extra={**self._identity, **fields})

    def error(self, name: str, *, exc_info: bool = True, **fields: Any) -> None:
        """Record an *unexpected* failure. Pass ``exc_info=False`` outside a handler.

        Error not warning so every broken iteration is one query for errors under
        ``autofix.pr_iteration`` rather than a list of names known in advance.
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
