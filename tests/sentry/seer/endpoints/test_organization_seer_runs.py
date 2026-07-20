from collections.abc import Mapping
from typing import Any
from unittest.mock import patch

from sentry.seer.models.run import SeerRunPullRequest, SeerRunType
from sentry.seer.run_questions import QUESTIONS, question_hash
from sentry.seer.runs_query import filtered_runs_queryset
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-explorer")
@with_feature("organizations:gen-ai-features")
@with_feature("organizations:gen-ai-consent-flow-removal")
class OrganizationSeerRunsEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-runs"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.organization.flags.allow_joinleave = True
        self.organization.save()
        self.login_as(user=self.user)

    def test_lists_runs_ordered_by_last_triggered(self) -> None:
        older = self.create_seer_run(
            organization=self.organization,
            user_id=self.user.id,
            seer_run_state_id=1,
            last_triggered_at=before_now(minutes=10),
        )
        newer = self.create_seer_run(
            organization=self.organization,
            user_id=self.user.id,
            seer_run_state_id=2,
            last_triggered_at=before_now(minutes=1),
        )

        response = self.get_success_response(self.organization.slug)

        assert [r["id"] for r in response.data] == [str(newer.uuid), str(older.uuid)]

    def test_scopes_to_organization(self) -> None:
        run = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        other_org = self.create_organization(owner=self.user)
        self.create_seer_run(organization=other_org, user_id=self.user.id)

        response = self.get_success_response(self.organization.slug)

        assert [r["id"] for r in response.data] == [str(run.uuid)]

    def test_is_mine_filter(self) -> None:
        mine = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        other_user = self.create_user()
        theirs = self.create_seer_run(organization=self.organization, user_id=other_user.id)

        # No filter returns runs regardless of owner.
        response = self.get_success_response(self.organization.slug)
        assert {r["id"] for r in response.data} == {str(mine.uuid), str(theirs.uuid)}

        # is:mine returns only the requesting user's runs.
        response = self.get_success_response(self.organization.slug, qs_params={"query": "is:mine"})
        assert [r["id"] for r in response.data] == [str(mine.uuid)]

        # !is:mine returns everyone else's runs.
        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "!is:mine"}
        )
        assert [r["id"] for r in response.data] == [str(theirs.uuid)]

    def test_agent_fields_present_and_null(self) -> None:
        with_agent = self.create_seer_run(
            organization=self.organization,
            user_id=self.user.id,
            last_triggered_at=before_now(minutes=1),
        )
        project = self.create_project(organization=self.organization)
        group = self.create_group(project=project)
        self.create_seer_agent_run(
            run=with_agent,
            title="Fix login bug",
            source="chat",
            project=project,
            group=group,
        )
        without_agent = self.create_seer_run(
            organization=self.organization,
            user_id=self.user.id,
            last_triggered_at=before_now(minutes=10),
        )

        response = self.get_success_response(self.organization.slug)
        by_id = {r["id"]: r for r in response.data}

        agent_row = by_id[str(with_agent.uuid)]
        assert agent_row["title"] == "Fix login bug"
        assert agent_row["source"] == "chat"
        assert agent_row["projectId"] == str(project.id)
        assert agent_row["groupId"] == str(group.id)

        plain_row = by_id[str(without_agent.uuid)]
        assert plain_row["title"] is None
        assert plain_row["source"] is None
        assert plain_row["projectId"] is None
        assert plain_row["groupId"] is None

    def test_is_agent_filter(self) -> None:
        with_agent = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=with_agent)
        without_agent = self.create_seer_run(organization=self.organization, user_id=self.user.id)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "is:agent"}
        )
        assert [r["id"] for r in response.data] == [str(with_agent.uuid)]

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "!is:agent"}
        )
        assert [r["id"] for r in response.data] == [str(without_agent.uuid)]

    def test_has_agent_filter(self) -> None:
        # has:agent must match is:agent semantics (runs *with* an agent), not the
        # inverse from the differing has: operator convention.
        with_agent = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=with_agent)
        without_agent = self.create_seer_run(organization=self.organization, user_id=self.user.id)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "has:agent"}
        )
        assert [r["id"] for r in response.data] == [str(with_agent.uuid)]

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "!has:agent"}
        )
        assert [r["id"] for r in response.data] == [str(without_agent.uuid)]

    def test_type_filter(self) -> None:
        explorer = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, type=SeerRunType.EXPLORER
        )
        self.create_seer_run(
            organization=self.organization, user_id=self.user.id, type=SeerRunType.PR_REVIEW
        )

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "type:explorer"}
        )
        assert [r["id"] for r in response.data] == [str(explorer.uuid)]

    def test_source_filter(self) -> None:
        run = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=run, source="night_shift")
        other = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=other, source="chat")

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "source:night_shift"}
        )
        assert [r["id"] for r in response.data] == [str(run.uuid)]

    def test_negated_source_excludes_null(self) -> None:
        # A negated match must not return rows where the field is NULL (runs with
        # no agent row); !has: is the way to select those.
        autofix = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=autofix, source="autofix")
        chat = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=chat, source="chat")
        # No agent row -> agent__source is NULL.
        self.create_seer_run(organization=self.organization, user_id=self.user.id)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "!source:autofix"}
        )
        assert [r["id"] for r in response.data] == [str(chat.uuid)]

    def test_source_in_filter(self) -> None:
        night_shift = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=night_shift, source="night_shift")
        chat = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=chat, source="chat")
        slack = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=slack, source="slack_thread")

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "source:[night_shift, chat]"}
        )
        assert {r["id"] for r in response.data} == {str(night_shift.uuid), str(chat.uuid)}

    def test_source_wildcard_in_filter(self) -> None:
        # A bracketed list with wildcards collapses to a regex string; it must
        # match via __regex rather than being iterated char-by-char by __in.
        slack = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=slack, source="slack_thread")
        night_shift = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=night_shift, source="night_shift")
        chat = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=chat, source="chat")

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "source:[slack*, night*]"}
        )
        assert {r["id"] for r in response.data} == {str(slack.uuid), str(night_shift.uuid)}

    def test_project_filter(self) -> None:
        project = self.create_project(organization=self.organization)
        run = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=run, project=project)
        other = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=other)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"project:{project.id}"}
        )
        assert [r["id"] for r in response.data] == [str(run.uuid)]

    def test_has_project_filter(self) -> None:
        # has:project / !has:project filter on whether a project is set rather
        # than 400ing on the empty (non-numeric) value.
        project = self.create_project(organization=self.organization)
        with_project = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=with_project, project=project)
        without_project = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=without_project, project=None)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "has:project"}
        )
        assert [r["id"] for r in response.data] == [str(with_project.uuid)]

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "!has:project"}
        )
        assert [r["id"] for r in response.data] == [str(without_project.uuid)]

    def test_group_filter(self) -> None:
        project = self.create_project(organization=self.organization)
        group = self.create_group(project=project)
        run = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=run, project=project, group=group)
        other = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=other, project=project)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": f"group:{group.id}"}
        )
        assert [r["id"] for r in response.data] == [str(run.uuid)]

    def test_group_in_filter(self) -> None:
        project = self.create_project(organization=self.organization)
        group_a = self.create_group(project=project)
        group_b = self.create_group(project=project)
        run_a = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=run_a, project=project, group=group_a)
        run_b = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=run_b, project=project, group=group_b)
        other = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=other, project=project)

        response = self.get_success_response(
            self.organization.slug,
            qs_params={"query": f"group:[{group_a.id}, {group_b.id}]"},
        )
        assert {r["id"] for r in response.data} == {str(run_a.uuid), str(run_b.uuid)}

    def test_has_group_filter(self) -> None:
        # has:group / !has:group filter on whether a group is set rather than
        # 400ing on the empty (non-numeric) value.
        project = self.create_project(organization=self.organization)
        group = self.create_group(project=project)
        with_group = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=with_group, project=project, group=group)
        without_group = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=without_group, project=project, group=None)

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "has:group"}
        )
        assert [r["id"] for r in response.data] == [str(with_group.uuid)]

        response = self.get_success_response(
            self.organization.slug, qs_params={"query": "!has:group"}
        )
        assert [r["id"] for r in response.data] == [str(without_group.uuid)]

    def test_free_text_query_matches_title(self) -> None:
        run = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=run, title="Fix login bug")
        other = self.create_seer_run(organization=self.organization, user_id=self.user.id)
        self.create_seer_agent_run(run=other, title="Refactor billing")

        response = self.get_success_response(self.organization.slug, qs_params={"query": "login"})
        assert [r["id"] for r in response.data] == [str(run.uuid)]

    def test_invalid_query_returns_400(self) -> None:
        self.get_error_response(
            self.organization.slug, qs_params={"query": "unknownkey:foo"}, status_code=400
        )

    def test_invalid_type_returns_400(self) -> None:
        self.get_error_response(
            self.organization.slug, qs_params={"query": "type:bogus"}, status_code=400
        )

    def test_non_numeric_project_returns_400(self) -> None:
        # A non-integer project value must 400, not 500 during SQL compilation.
        self.get_error_response(
            self.organization.slug, qs_params={"query": "project:abc"}, status_code=400
        )

    def test_non_numeric_group_returns_400(self) -> None:
        # A non-integer group value must 400, not 500 during SQL compilation.
        self.get_error_response(
            self.organization.slug, qs_params={"query": "group:abc"}, status_code=400
        )

    def test_pagination(self) -> None:
        runs = [
            self.create_seer_run(
                organization=self.organization,
                user_id=self.user.id,
                last_triggered_at=before_now(minutes=i),
            )
            for i in range(1, 4)
        ]
        # Newest first.
        expected = [str(runs[0].uuid), str(runs[1].uuid)]

        response = self.get_success_response(self.organization.slug, qs_params={"per_page": "2"})
        assert [r["id"] for r in response.data] == expected
        assert 'rel="next"; results="true"' in response.headers["Link"]

    @with_feature("organizations:seer-run-questions")
    def test_default_page_size_is_10_with_outputs(self) -> None:
        for i in range(1, 12):
            self.create_seer_run(
                organization=self.organization,
                user_id=self.user.id,
                last_triggered_at=before_now(minutes=i),
            )

        response = self.get_success_response(
            self.organization.slug, qs_params={"expand": "questions"}
        )

        assert len(response.data) == 10
        assert 'rel="next"; results="true"' in response.headers["Link"]

    def test_default_page_size_without_outputs(self) -> None:
        for i in range(1, 12):
            self.create_seer_run(
                organization=self.organization,
                user_id=self.user.id,
                last_triggered_at=before_now(minutes=i),
            )

        # Without expanded questions the small default doesn't apply, so all runs
        # fit on the first page.
        response = self.get_success_response(self.organization.slug)

        assert len(response.data) == 11

    def test_ids_serialized_as_strings(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=42
        )

        response = self.get_success_response(self.organization.slug)
        data = response.data[0]
        assert data["id"] == str(run.uuid)
        assert data["userId"] == str(self.user.id)

    def test_pull_requests_serialized_with_state(self) -> None:
        run = self.create_seer_run(
            organization=self.organization,
            user_id=self.user.id,
            last_triggered_at=before_now(minutes=1),
        )
        without_prs = self.create_seer_run(
            organization=self.organization,
            user_id=self.user.id,
            last_triggered_at=before_now(minutes=10),
        )
        project = self.create_project(organization=self.organization)
        repo = self.create_repo(project, name="getsentry/sentry")
        merged_pr = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key="123"
        )
        merged_at = before_now(minutes=5)
        merged_pr.update(state="merged", merged_at=merged_at)
        open_pr = self.create_pull_request(
            repository_id=repo.id, organization_id=self.organization.id, key="124"
        )
        SeerRunPullRequest.objects.create(seer_run=run, pull_request=merged_pr)
        SeerRunPullRequest.objects.create(seer_run=run, pull_request=open_pr)

        response = self.get_success_response(self.organization.slug)
        by_id = {r["id"]: r for r in response.data}

        # The PR number is exposed as the serializer's ``id`` (PullRequest.key).
        prs_by_key = {pr["id"]: pr for pr in by_id[str(run.uuid)]["pullRequests"]}
        assert prs_by_key["123"]["status"] == "merged"
        assert prs_by_key["123"]["mergedAt"] == merged_at
        # Standard PullRequestSerializer fields come through too.
        assert "repository" in prs_by_key["123"]
        # No webhook has reported a state for the second PR.
        assert prs_by_key["124"]["status"] is None
        assert prs_by_key["124"]["mergedAt"] is None

        assert by_id[str(without_prs.uuid)]["pullRequests"] == []

    def test_outputs_absent_without_flag(self) -> None:
        self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=1
        )

        with patch("sentry.seer.run_questions.run_oneshot") as mock_run:
            response = self.get_success_response(self.organization.slug)

        assert "outputs" not in response.data[0]
        assert mock_run.call_count == 0

    def test_outputs_requires_feature(self) -> None:
        self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=1
        )

        # Feature off: expand=questions is ignored, no one-shot calls, no outputs.
        with patch("sentry.seer.run_questions.run_oneshot") as mock_run:
            response = self.get_success_response(
                self.organization.slug, qs_params={"expand": "questions"}
            )

        assert "outputs" not in response.data[0]
        assert mock_run.call_count == 0

    @with_feature("organizations:seer-run-questions")
    def test_outputs(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )

        def fake_oneshot(
            oneshot_id: str, payload: Mapping[str, Any], organization: Any, **kwargs: Any
        ) -> dict[str, str]:
            return {"answer": f"answer to: {payload['question']}"}

        with patch("sentry.seer.run_questions.run_oneshot", side_effect=fake_oneshot) as mock_run:
            response = self.get_success_response(
                self.organization.slug, qs_params={"expand": "questions"}
            )

        row = next(r for r in response.data if r["id"] == str(run.uuid))
        assert [q["key"] for q in row["outputs"]] == [q.key for q in QUESTIONS]
        assert [q["answer"] for q in row["outputs"]] == [
            f"answer to: {q.question}" for q in QUESTIONS
        ]
        assert mock_run.call_count == len(QUESTIONS)

    @with_feature("organizations:seer-run-questions")
    def test_builtin_and_user_questions_are_additive(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )
        user_questions = ["What broke?", "Who is affected?"]

        def fake_oneshot(
            oneshot_id: str, payload: Mapping[str, Any], organization: Any, **kwargs: Any
        ) -> dict[str, str]:
            return {"answer": f"answer to: {payload['question']}"}

        with patch("sentry.seer.run_questions.run_oneshot", side_effect=fake_oneshot) as mock_run:
            response = self.get_success_response(
                self.organization.slug,
                qs_params={"expand": "questions", "question": user_questions},
            )

        row = next(r for r in response.data if r["id"] == str(run.uuid))
        # Built-in questions come first (no echoed prompt), then the user ones in
        # request order (with their prompt echoed).
        assert [o["key"] for o in row["outputs"]] == [
            *(q.key for q in QUESTIONS),
            "user_0",
            "user_1",
        ]
        for output in row["outputs"][: len(QUESTIONS)]:
            assert "question" not in output
        assert [o["question"] for o in row["outputs"][len(QUESTIONS) :]] == user_questions
        assert mock_run.call_count == len(QUESTIONS) + len(user_questions)

    @with_feature("organizations:seer-run-questions")
    def test_outputs_skips_non_explorer_runs(self) -> None:
        pr_review = self.create_seer_run(
            organization=self.organization,
            user_id=self.user.id,
            seer_run_state_id=7,
            type=SeerRunType.PR_REVIEW,
        )

        with patch("sentry.seer.run_questions.run_oneshot") as mock_run:
            response = self.get_success_response(
                self.organization.slug, qs_params={"expand": "questions"}
            )

        row = next(r for r in response.data if r["id"] == str(pr_review.uuid))
        # Non-explorer runs carry an empty list and trigger no one-shot calls.
        assert row["outputs"] == []
        assert mock_run.call_count == 0

    @with_feature("organizations:seer-run-questions")
    def test_outputs_skips_runs_without_state_id(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=None
        )

        with patch("sentry.seer.run_questions.run_oneshot") as mock_run:
            response = self.get_success_response(
                self.organization.slug, qs_params={"expand": "questions"}
            )

        row = next(r for r in response.data if r["id"] == str(run.uuid))
        assert row["outputs"] == []
        assert mock_run.call_count == 0

    @with_feature("organizations:seer-run-questions")
    def test_builtin_outputs_include_hash_and_omit_question(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )

        with patch(
            "sentry.seer.run_questions.run_oneshot",
            return_value={"answer": "an answer"},
        ):
            response = self.get_success_response(
                self.organization.slug, qs_params={"expand": "questions"}
            )

        row = next(r for r in response.data if r["id"] == str(run.uuid))
        for output, builtin in zip(row["outputs"], QUESTIONS):
            assert output["hash"] == question_hash(builtin.question)
            # Built-in questions don't echo their prompt text.
            assert "question" not in output

    @with_feature("organizations:seer-run-questions")
    def test_user_questions_without_expand_are_user_only(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )
        questions = ["What broke?", "Who is affected?"]

        def fake_oneshot(
            oneshot_id: str, payload: Mapping[str, Any], organization: Any, **kwargs: Any
        ) -> dict[str, str]:
            return {"answer": f"answer to: {payload['question']}"}

        with patch("sentry.seer.run_questions.run_oneshot", side_effect=fake_oneshot) as mock_run:
            response = self.get_success_response(
                self.organization.slug, qs_params={"question": questions}
            )

        row = next(r for r in response.data if r["id"] == str(run.uuid))
        # Without expand=questions the built-in set is not included, so only the
        # supplied questions are answered.
        assert [o["key"] for o in row["outputs"]] == ["user_0", "user_1"]
        assert [o["question"] for o in row["outputs"]] == questions
        assert [o["hash"] for o in row["outputs"]] == [question_hash(q) for q in questions]
        assert [o["answer"] for o in row["outputs"]] == [f"answer to: {q}" for q in questions]
        assert mock_run.call_count == len(questions)

    @with_feature("organizations:seer-run-questions")
    def test_user_questions_strip_and_ignore_blanks(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )

        with patch(
            "sentry.seer.run_questions.run_oneshot",
            return_value={"answer": "an answer"},
        ) as mock_run:
            response = self.get_success_response(
                self.organization.slug, qs_params={"question": ["  What broke?  ", "   "]}
            )

        row = next(r for r in response.data if r["id"] == str(run.uuid))
        assert [o["question"] for o in row["outputs"]] == ["What broke?"]
        assert mock_run.call_count == 1

    def test_user_questions_require_feature(self) -> None:
        self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )

        with patch("sentry.seer.run_questions.run_oneshot") as mock_run:
            response = self.get_success_response(
                self.organization.slug, qs_params={"question": "What broke?"}
            )

        assert "outputs" not in response.data[0]
        assert mock_run.call_count == 0

    @with_feature("organizations:seer-run-questions")
    def test_too_many_questions_returns_400(self) -> None:
        self.get_error_response(
            self.organization.slug,
            qs_params={"question": [f"q{i}" for i in range(6)]},
            status_code=400,
        )

    def test_post_lists_runs(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=1
        )

        response = self.get_success_response(self.organization.slug, method="post")

        assert [r["id"] for r in response.data] == [str(run.uuid)]
        assert "outputs" not in response.data[0]

    @with_feature("organizations:seer-run-questions")
    def test_post_builtin_and_user_questions_are_additive(self) -> None:
        run = self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )
        user_questions = ["What broke?", "Who is affected?"]

        def fake_oneshot(
            oneshot_id: str, payload: Mapping[str, Any], organization: Any, **kwargs: Any
        ) -> dict[str, str]:
            return {"answer": f"answer to: {payload['question']}"}

        with patch("sentry.seer.run_questions.run_oneshot", side_effect=fake_oneshot) as mock_run:
            response = self.get_success_response(
                self.organization.slug,
                method="post",
                expand=["questions"],
                question=user_questions,
            )

        row = next(r for r in response.data if r["id"] == str(run.uuid))
        assert [o["key"] for o in row["outputs"]] == [
            *(q.key for q in QUESTIONS),
            "user_0",
            "user_1",
        ]
        assert [o["question"] for o in row["outputs"][len(QUESTIONS) :]] == user_questions
        assert mock_run.call_count == len(QUESTIONS) + len(user_questions)

    @with_feature("organizations:seer-run-questions")
    def test_post_too_many_questions_returns_400(self) -> None:
        self.get_error_response(
            self.organization.slug,
            method="post",
            question=[f"q{i}" for i in range(6)],
            status_code=400,
        )

    def test_post_questions_require_feature(self) -> None:
        self.create_seer_run(
            organization=self.organization, user_id=self.user.id, seer_run_state_id=99
        )

        with patch("sentry.seer.run_questions.run_oneshot") as mock_run:
            response = self.get_success_response(
                self.organization.slug, method="post", question=["What broke?"]
            )

        assert "outputs" not in response.data[0]
        assert mock_run.call_count == 0


class OrganizationSeerRunsEndpointAccessTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-runs"

    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_missing_features_returns_403(self) -> None:
        with self.feature({"organizations:seer-explorer": True}):
            self.get_error_response(self.organization.slug, status_code=403)


class FilteredRunsQuerysetTest(TestCase):
    def test_scopes_to_accessible_projects(self) -> None:
        accessible = self.create_project(organization=self.organization)
        hidden = self.create_project(organization=self.organization)

        run_accessible = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run=run_accessible, project=accessible)
        run_hidden = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run=run_hidden, project=hidden)
        # No project (agent row with null project) and no agent row at all are
        # both kept regardless of project access.
        run_null_project = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run=run_null_project, project=None)
        run_no_agent = self.create_seer_run(organization=self.organization)

        queryset = filtered_runs_queryset(
            organization=self.organization,
            query="",
            user_id=None,
            accessible_project_ids={accessible.id},
            start=None,
            end=None,
        )

        assert {r.id for r in queryset} == {
            run_accessible.id,
            run_null_project.id,
            run_no_agent.id,
        }
        assert run_hidden.id not in {r.id for r in queryset}
