from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from django.db import IntegrityError, router, transaction
from django.db.models.query import QuerySet
from sentry_conventions.attributes import ATTRIBUTE_NAMES

from sentry.ai_monitoring.models import AIConversationMetadata
from sentry.ai_monitoring.tasks import generate_ai_conversation_title
from sentry.ai_monitoring.utils import (
    clamp_conversation_id_for_storage,
    clamp_user_message,
    conversation_id_hash,
    fallback_title_from_message,
    generate_conversation_title,
    generate_title_with_seer,
    parse_conversation_title_span,
)
from sentry.seer.signed_seer_api import SeerViewerContext
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.utils import json

TS = 1609455600.0


def _attr(value: Any) -> dict[str, Any]:
    return {"value": value, "type": "string"}


def make_gen_ai_span(
    *,
    project_id: int,
    conversation_id: str = "conv-1",
    start_timestamp: float | datetime = TS,
    messages: Any | None = None,
    use_request_messages: bool = False,
    omit_conversation_id: bool = False,
    omit_messages: bool = False,
) -> dict[str, Any]:
    if messages is None:
        messages = json.dumps([{"role": "user", "content": "How do I reset my password?"}])

    attributes: dict[str, Any] = {}
    if not omit_conversation_id:
        attributes[ATTRIBUTE_NAMES.GEN_AI_CONVERSATION_ID] = _attr(conversation_id)
    if not omit_messages:
        key = (
            ATTRIBUTE_NAMES.GEN_AI_REQUEST_MESSAGES
            if use_request_messages
            else ATTRIBUTE_NAMES.GEN_AI_INPUT_MESSAGES
        )
        attributes[key] = _attr(messages)

    end_timestamp: float | datetime = (
        start_timestamp + 1.0 if isinstance(start_timestamp, (int, float)) else start_timestamp
    )
    return {
        "project_id": project_id,
        "start_timestamp": start_timestamp,
        "end_timestamp": end_timestamp,
        "span_id": "abcdef0123456789",
        "trace_id": "d099bf9ad5a143cf8f83a98081d0ed3b",
        "attributes": attributes,
    }


def _mock_seer_success(title: str = "Reset Password Help") -> MagicMock:
    mock_response = MagicMock(status=200)
    mock_response.json.return_value = {"content": json.dumps({"title": title})}
    return mock_response


def _ts(offset_seconds: float = 0.0) -> datetime:
    return datetime.fromtimestamp(TS + offset_seconds, tz=UTC)


class TitleHelpersTest(TestCase):
    def test_conversation_id_hash_is_sha256_hex(self) -> None:
        h = conversation_id_hash("hello")
        assert len(h) == 64
        assert h == conversation_id_hash("hello")
        assert h != conversation_id_hash("hello!")

    def test_clamp_conversation_id_for_storage(self) -> None:
        assert clamp_conversation_id_for_storage("short") == "short"
        assert clamp_conversation_id_for_storage("x" * 2048) == "x" * 2048

        long_id = "y" * 3000
        clamped = clamp_conversation_id_for_storage(long_id)
        assert clamped == "y" * 2040 + "..."
        assert len(clamped) == 2043
        # Hash stays on the full id; storage clamp must not change the hash input.
        assert conversation_id_hash(long_id) != conversation_id_hash(clamped)

    def test_parse_span_success(self) -> None:
        data = parse_conversation_title_span(
            make_gen_ai_span(project_id=1, conversation_id="  abc  ", start_timestamp=TS + 0.5)
        )
        assert data is not None
        assert data.project_id == 1
        assert data.conversation_id == "abc"
        assert data.source_timestamp == _ts(0.5)
        assert data.first_user_message == "How do I reset my password?"

    def test_parse_span_prefers_input_messages(self) -> None:
        span = make_gen_ai_span(
            project_id=1,
            messages=json.dumps(
                [
                    {"role": "system", "content": "sys"},
                    {"role": "user", "content": "from input"},
                ]
            ),
        )
        span["attributes"][ATTRIBUTE_NAMES.GEN_AI_REQUEST_MESSAGES] = _attr(
            json.dumps([{"role": "user", "content": "from request"}])
        )
        data = parse_conversation_title_span(span)
        assert data is not None
        assert data.first_user_message == "from input"

    def test_parse_span_falls_back_to_request_messages(self) -> None:
        data = parse_conversation_title_span(
            make_gen_ai_span(
                project_id=1,
                messages=json.dumps([{"role": "user", "content": "from request"}]),
                use_request_messages=True,
            )
        )
        assert data is not None
        assert data.first_user_message == "from request"

    def test_parse_span_missing_fields(self) -> None:
        assert (
            parse_conversation_title_span(make_gen_ai_span(project_id=1, omit_conversation_id=True))
            is None
        )
        assert (
            parse_conversation_title_span(make_gen_ai_span(project_id=1, omit_messages=True))
            is None
        )

    def test_parse_span_skips_privacy_filtered_messages(self) -> None:
        assert (
            parse_conversation_title_span(make_gen_ai_span(project_id=1, messages="[Filtered]"))
            is None
        )
        assert (
            parse_conversation_title_span(
                make_gen_ai_span(
                    project_id=1,
                    messages=json.dumps([{"role": "user", "content": "[Filtered]"}]),
                )
            )
            is None
        )

    def test_fallback_title_truncates_words_and_length(self) -> None:
        assert fallback_title_from_message("hello world") == "hello world"

        long_words = " ".join(f"word{i}" for i in range(30))
        truncated = fallback_title_from_message(long_words)
        assert truncated.endswith("...")
        assert truncated.startswith("word0 word1")
        assert "word12" not in truncated

        clamped = fallback_title_from_message("x" * 500)
        assert len(clamped) <= 256
        assert clamped.endswith("...")

    def test_clamp_user_message(self) -> None:
        assert clamp_user_message("short") == "short"
        assert len(clamp_user_message("a" * 9000)) == 8 * 1024

    @patch("sentry.ai_monitoring.utils.make_llm_generate_request")
    def test_generate_title_with_seer_success(self, mock_request: MagicMock) -> None:
        mock_request.return_value = _mock_seer_success('  "Help me login"  ')
        viewer_context = SeerViewerContext(organization_id=42)
        assert (
            generate_title_with_seer("I cannot log in", viewer_context=viewer_context)
            == "Help me login"
        )
        body = mock_request.call_args.args[0]
        assert body["provider"] == "gemini"
        assert body["model"] == "flash-lite"
        assert body["referrer"] == "ai_monitoring.conversation_title"
        assert body["reasoning"] == "off"
        assert body["response_schema"] == {
            "type": "object",
            "properties": {"title": {"type": "string"}},
            "required": ["title"],
        }
        assert mock_request.call_args.kwargs["viewer_context"] == viewer_context

    @patch("sentry.ai_monitoring.utils.make_llm_generate_request")
    def test_generate_title_with_seer_plain_string_content(self, mock_request: MagicMock) -> None:
        mock_response = MagicMock(status=200)
        mock_response.json.return_value = {"content": "Plain text title"}
        mock_request.return_value = mock_response
        assert generate_title_with_seer("msg") == "Plain text title"

    @patch("sentry.ai_monitoring.utils.make_llm_generate_request")
    def test_generate_title_with_seer_invalid_structured_content(
        self, mock_request: MagicMock
    ) -> None:
        mock_response = MagicMock(status=200)
        mock_response.json.return_value = {"content": json.dumps({"not_title": "x"})}
        mock_request.return_value = mock_response
        assert generate_title_with_seer("msg") is None

    @patch("sentry.ai_monitoring.utils.make_llm_generate_request")
    def test_generate_title_with_seer_http_error(self, mock_request: MagicMock) -> None:
        mock_request.return_value = MagicMock(status=500)
        assert generate_title_with_seer("msg") is None

    @patch("sentry.ai_monitoring.utils.make_llm_generate_request")
    def test_generate_conversation_title_falls_back(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = Exception("boom")
        assert (
            generate_conversation_title("How do I reset my password today?")
            == "How do I reset my password today?"
        )


@with_feature("organizations:gen-ai-conversation-title-generation")
class GenerateAIConversationTitleTaskTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()

    def _span(self, **kwargs: Any) -> dict[str, Any]:
        kwargs.setdefault("project_id", self.project.id)
        return make_gen_ai_span(**kwargs)

    def _create_metadata(
        self,
        *,
        title: str,
        source_timestamp: datetime,
        conversation_id: str = "conv-1",
    ) -> AIConversationMetadata:
        return AIConversationMetadata.objects.create(
            project=self.project,
            conversation_id=conversation_id,
            conversation_id_hash=conversation_id_hash(conversation_id),
            title=title,
            title_source_timestamp=source_timestamp,
        )

    def _row(self, conversation_id: str = "conv-1") -> AIConversationMetadata:
        return AIConversationMetadata.objects.get(
            project=self.project,
            conversation_id_hash=conversation_id_hash(conversation_id),
        )

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="AI Title")
    def test_creates_metadata_row(self, mock_generate: MagicMock) -> None:
        generate_ai_conversation_title(self._span(start_timestamp=TS))

        row = self._row()
        assert row.conversation_id == "conv-1"
        assert row.conversation_id_hash == conversation_id_hash("conv-1")
        assert row.title == "AI Title"
        assert row.title_source_timestamp == _ts()
        mock_generate.assert_called_once_with(
            "How do I reset my password?",
            viewer_context={"organization_id": self.project.organization_id},
        )

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="AI Title")
    def test_stores_clamped_conversation_id_and_hashes_full(self, mock_generate: MagicMock) -> None:
        long_id = "c" * 3000
        generate_ai_conversation_title(self._span(conversation_id=long_id, start_timestamp=TS))

        row = self._row(long_id)
        assert row.conversation_id == "c" * 2040 + "..."
        assert row.conversation_id_hash == conversation_id_hash(long_id)
        mock_generate.assert_called_once()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Later Title")
    def test_skips_when_existing_title_is_earlier(self, mock_generate: MagicMock) -> None:
        earlier = _ts()
        self._create_metadata(title="Earlier Title", source_timestamp=earlier)

        generate_ai_conversation_title(self._span(start_timestamp=TS + 60))

        row = self._row()
        assert row.title == "Earlier Title"
        assert row.title_source_timestamp == earlier
        mock_generate.assert_not_called()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Same Ts Title")
    def test_equal_timestamp_keeps_existing(self, mock_generate: MagicMock) -> None:
        self._create_metadata(title="Original", source_timestamp=_ts())

        generate_ai_conversation_title(self._span(start_timestamp=TS))
        assert self._row().title == "Original"
        mock_generate.assert_not_called()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Earlier Title")
    def test_supersedes_when_source_is_strictly_earlier(self, mock_generate: MagicMock) -> None:
        self._create_metadata(title="Later Turn Title", source_timestamp=_ts(60))

        generate_ai_conversation_title(self._span(start_timestamp=TS))

        row = self._row()
        assert row.title == "Earlier Title"
        assert row.title_source_timestamp == _ts()
        mock_generate.assert_called_once()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title")
    def test_discards_after_seer_if_earlier_row_appeared(self, mock_generate: MagicMock) -> None:
        """
        Race: phase 1 saw no row, Seer ran, but another worker wrote a strictly
        earlier source before phase 3 — our title must be discarded.
        """
        earlier_ts = _ts(-10)

        def seer_side_effect(message: str, **kwargs: Any) -> str:
            self._create_metadata(title="Concurrent Earlier", source_timestamp=earlier_ts)
            return "My Title"

        mock_generate.side_effect = seer_side_effect
        generate_ai_conversation_title(self._span(start_timestamp=TS))

        row = self._row()
        assert row.title == "Concurrent Earlier"
        assert row.title_source_timestamp == earlier_ts

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="New Title")
    def test_integrity_error_then_supersede(self, mock_generate: MagicMock) -> None:
        """
        Concurrent create race: first conditional update misses stripped, create
        hits the unique constraint, second update supersedes the later row.
        """
        self._create_metadata(title="Later Concurrent", source_timestamp=_ts(60))

        update_calls = {"n": 0}
        real_update = QuerySet.update

        def fake_update(self: QuerySet[Any, Any], **kwargs: Any) -> int:
            if self.model is AIConversationMetadata and "title" in kwargs:
                update_calls["n"] += 1
                # First write attempt acts as if the row was not yet visible.
                if update_calls["n"] == 1:
                    return 0
            return real_update(self, **kwargs)

        with patch.object(QuerySet, "update", fake_update):
            generate_ai_conversation_title(self._span(start_timestamp=TS))

        row = self._row()
        assert row.title == "New Title"
        assert row.title_source_timestamp == _ts()
        assert AIConversationMetadata.objects.filter(project=self.project).count() == 1

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Unused")
    def test_skips_missing_conversation_id(self, mock_generate: MagicMock) -> None:
        generate_ai_conversation_title(self._span(omit_conversation_id=True))
        assert AIConversationMetadata.objects.count() == 0
        mock_generate.assert_not_called()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Unused")
    def test_skips_missing_user_message(self, mock_generate: MagicMock) -> None:
        generate_ai_conversation_title(self._span(omit_messages=True))
        assert AIConversationMetadata.objects.count() == 0
        mock_generate.assert_not_called()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Unused")
    def test_skips_missing_project(self, mock_generate: MagicMock) -> None:
        generate_ai_conversation_title(self._span(project_id=999999999))
        assert AIConversationMetadata.objects.count() == 0
        mock_generate.assert_not_called()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Unused")
    def test_skips_when_hide_ai_features(self, mock_generate: MagicMock) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)
        generate_ai_conversation_title(self._span())
        assert AIConversationMetadata.objects.count() == 0
        mock_generate.assert_not_called()

    @patch("sentry.ai_monitoring.tasks.generate_conversation_title", return_value="Unused")
    def test_skips_when_feature_disabled(self, mock_generate: MagicMock) -> None:
        with self.feature({"organizations:gen-ai-conversation-title-generation": False}):
            generate_ai_conversation_title(self._span())
        assert AIConversationMetadata.objects.count() == 0
        mock_generate.assert_not_called()

    @patch("sentry.ai_monitoring.utils.make_llm_generate_request")
    def test_end_to_end_with_mocked_seer(self, mock_request: MagicMock) -> None:
        mock_request.return_value = _mock_seer_success("Password Reset Guidance")
        generate_ai_conversation_title(
            self._span(
                conversation_id="e2e-conv",
                messages=json.dumps([{"role": "user", "content": "How do I reset my password?"}]),
                start_timestamp=TS,
            )
        )

        row = self._row("e2e-conv")
        assert row.conversation_id == "e2e-conv"
        assert row.title == "Password Reset Guidance"
        mock_request.assert_called_once()

    @patch("sentry.ai_monitoring.utils.make_llm_generate_request")
    def test_end_to_end_seer_failure_uses_fallback(self, mock_request: MagicMock) -> None:
        mock_request.side_effect = Exception("network down")
        generate_ai_conversation_title(
            self._span(messages=json.dumps([{"role": "user", "content": "Short question"}]))
        )
        assert self._row().title == "Short question"

    def test_unique_constraint_project_conversation_hash(self) -> None:
        h = conversation_id_hash("same")
        self._create_metadata(
            title="One", source_timestamp=datetime.now(UTC), conversation_id="same"
        )
        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(AIConversationMetadata)),
        ):
            AIConversationMetadata.objects.create(
                project=self.project,
                conversation_id="same",
                conversation_id_hash=h,
                title="Two",
                title_source_timestamp=datetime.now(UTC) + timedelta(seconds=1),
            )
