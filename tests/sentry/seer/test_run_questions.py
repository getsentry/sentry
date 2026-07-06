from collections.abc import Mapping
from typing import Any
from unittest.mock import patch

from sentry.models.organization import Organization
from sentry.seer.run_questions import QUESTIONS, get_run_questions
from sentry.testutils.cases import TestCase


class GetRunQuestionsTest(TestCase):
    def _answer_for(self, run_id: int, question: str) -> str:
        return f"run {run_id} answer to: {question}"

    def _fake_oneshot(
        self,
        oneshot_id: str,
        payload: Mapping[str, Any],
        organization: Organization,
        **kwargs: Any,
    ) -> dict[str, str]:
        return {"answer": self._answer_for(payload["run_id"], payload["question"])}

    def test_answers_every_question_in_order(self) -> None:
        with patch(
            "sentry.seer.run_questions.run_oneshot", side_effect=self._fake_oneshot
        ) as mock_run:
            result = get_run_questions([123], self.organization)

        answers = result[123]
        assert [q["key"] for q in answers] == [q.key for q in QUESTIONS]
        assert [q["question"] for q in answers] == [q.question for q in QUESTIONS]
        assert [q["answer"] for q in answers] == [
            self._answer_for(123, q.question) for q in QUESTIONS
        ]
        assert mock_run.call_count == len(QUESTIONS)

    def test_answers_multiple_runs_in_parallel(self) -> None:
        with patch(
            "sentry.seer.run_questions.run_oneshot", side_effect=self._fake_oneshot
        ) as mock_run:
            result = get_run_questions([1, 2, 3], self.organization)

        assert set(result) == {1, 2, 3}
        for run_id in (1, 2, 3):
            assert [q["answer"] for q in result[run_id]] == [
                self._answer_for(run_id, q.question) for q in QUESTIONS
            ]
        # One one-shot per (run, question) pair.
        assert mock_run.call_count == 3 * len(QUESTIONS)

    def test_duplicate_run_ids_answered_once(self) -> None:
        with patch(
            "sentry.seer.run_questions.run_oneshot", side_effect=self._fake_oneshot
        ) as mock_run:
            result = get_run_questions([7, 7, 7], self.organization)

        assert set(result) == {7}
        assert [q["answer"] for q in result[7]] == [
            self._answer_for(7, q.question) for q in QUESTIONS
        ]
        # A repeated run is answered only once, not once per occurrence.
        assert mock_run.call_count == len(QUESTIONS)

    def test_empty_run_ids_returns_empty(self) -> None:
        with patch("sentry.seer.run_questions.run_oneshot") as mock_run:
            result = get_run_questions([], self.organization)

        assert result == {}
        assert mock_run.call_count == 0

    def test_best_effort_on_api_error(self) -> None:
        with patch(
            "sentry.seer.run_questions.run_oneshot",
            side_effect=Exception("boom"),
        ):
            result = get_run_questions([789], self.organization)

        assert [q["answer"] for q in result[789]] == ["" for _ in QUESTIONS]

    def test_best_effort_on_empty_result(self) -> None:
        with patch("sentry.seer.run_questions.run_oneshot", return_value={}):
            result = get_run_questions([1011], self.organization)

        assert [q["answer"] for q in result[1011]] == ["" for _ in QUESTIONS]
