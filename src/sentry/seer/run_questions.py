"""Ask a fixed set of questions about a Seer Agent (Explorer) run.

Each question is answered by the ``agent_question`` one-shot on Seer: a single
structured LLM call over the run's conversation history that returns a markdown
``answer``. The question *text* lives here in Sentry, not in Seer, so we can
iterate on the questions without a Seer deploy.

Answers are cached in Redis per (organization, run, question) because narrating
a run is expensive and the answer is stable for a completed run. Every
(run, question) pair is answered concurrently since they are all independent.
"""

from __future__ import annotations

import hashlib
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import timedelta
from typing import TypedDict

from sentry.cache import default_cache
from sentry.models.organization import Organization
from sentry.seer.oneshot import run_oneshot
from sentry.utils.concurrent import ContextPropagatingThreadPoolExecutor

logger = logging.getLogger(__name__)

_ONESHOT_ID = "agent_question"

# For now cache the results in Redis. Long term we should persist these
# (probably to objectstore) but it's very unclear what the eventual
# structure will be so avoid making a call on model/stoage for now.
_ANSWER_CACHE_TTL = int(timedelta(hours=24).total_seconds())

_MAX_WORKERS = 10


@dataclass(frozen=True)
class Question:
    # Stable identifier (does not change when the prompt does).
    key: str
    # The prompt sent to the one-shot.
    question: str
    user_supplied: bool = False


class RunQuestion(TypedDict):
    # Stable identifier (does not change when the prompt does).
    key: str
    # The prompt sent to the one-shot.
    question: str
    # Digest of the question text; stable for a given prompt regardless of key.
    hash: str
    # The one-shot's markdown answer, or "" when unavailable.
    answer: str
    user_supplied: bool


# For now define the questions here so they are easy to iterate on.
# Eventually we can move them to Seer where they will be easier to use
# in evals.
QUESTIONS: tuple[Question, ...] = (
    Question(
        key="summary",
        question=(
            "Summarize this Autofix run the way an engineer would write up an issue: "
            "what the problem is, how you investigated and debugged it (the key "
            "evidence and root cause you found), and the fix you're proposing. "
            "This should be short, 1 paragraph at most."
        ),
    ),
    Question(
        key="follow_up",
        question=(
            "Given this Autofix suggest 5 or less bullet point follow ups for "
            "those working on the project. If there are no reasonable follow ups "
            "return the empty string."
        ),
    ),
)


def question_hash(question: str) -> str:
    return hashlib.sha1(question.encode("utf-8")).hexdigest()


def build_user_questions(questions: Sequence[str]) -> list[Question]:
    """Wrap user-supplied question strings as ``Question`` objects.

    They have no stable identifier, so we mint a positional ``user_<index>`` key.
    """
    return [
        Question(key=f"user_{i}", question=q, user_supplied=True) for i, q in enumerate(questions)
    ]


def _answer_cache_key(organization: Organization, run_id: int, question: str) -> str:
    return f"seer-run-question-v1:{organization.id}:{run_id}:{question_hash(question)}"


def _get_answer(
    organization: Organization,
    run_id: int,
    question: str,
    *,
    user_id: int | None,
    timeout: int | float | None,
) -> str:
    """Return the cached answer for one question, or ask Seer and cache it.

    Best-effort: returns an empty string when the one-shot fails or produces no
    answer so the remaining questions (and the enclosing response) still
    resolve.
    """
    cache_key = _answer_cache_key(organization, run_id, question)
    cached = default_cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        result = run_oneshot(
            _ONESHOT_ID,
            {"run_id": run_id, "question": question},
            organization,
            user_id=user_id,
            timeout=timeout,
        )
    except Exception:
        logger.exception("seer.run_questions.failed", extra={"run_id": run_id})
        return ""

    answer = result.get("answer")
    # A missing answer means the one-shot failed, so retry rather than cache it.
    # An empty string is a real answer (e.g. no follow-ups) and is cached.
    if answer is None:
        return ""

    default_cache.set(cache_key, answer, timeout=_ANSWER_CACHE_TTL)
    return answer


def get_run_questions(
    run_ids: Sequence[int],
    organization: Organization,
    *,
    questions: Sequence[Question] = QUESTIONS,
    user_id: int | None = None,
    timeout: int | float | None = None,
) -> dict[int, list[RunQuestion]]:
    """Answer ``questions`` about each run in ``run_ids``.

    Defaults to the built-in ``QUESTIONS`` set; callers may pass a user-supplied
    set (e.g. from :func:`build_user_questions`) to answer arbitrary prompts.

    Every (run, question) pair is answered concurrently in a single shared pool,
    so multiple runs parallelize with each other as well as across questions.
    Returns a mapping from run id to its answers in ``questions`` order.
    """
    unique_run_ids = list(dict.fromkeys(run_ids))
    tasks = [(run_id, question) for run_id in unique_run_ids for question in questions]

    with ContextPropagatingThreadPoolExecutor(max_workers=_MAX_WORKERS) as executor:
        answers = list(
            executor.map(
                lambda task: _get_answer(
                    organization, task[0], task[1].question, user_id=user_id, timeout=timeout
                ),
                tasks,
            )
        )

    result: dict[int, list[RunQuestion]] = {run_id: [] for run_id in unique_run_ids}
    for (run_id, question), answer in zip(tasks, answers):
        result[run_id].append(
            {
                "key": question.key,
                "question": question.question,
                "hash": question_hash(question.question),
                "answer": answer,
                "user_supplied": question.user_supplied,
            }
        )
    return result
