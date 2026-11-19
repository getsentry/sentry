from __future__ import annotations

from typing import Any
from unittest.mock import patch

from sentry.snuba.referrer import Referrer
from sentry.testutils.cases import APITestCase
from sentry.timeseries_annotations.models import AnnotationType, TimeseriesAnnotation
from sentry.utils import json

_TIMELINE_REFERRER = Referrer.API_TIMESERIES_ANNOTATIONS_SDK_CONFIG_TIMELINE.value
_PROJECT_COL = "project.id"
_HASH_COL = "tags[sentry.sdk_config.hash,string]"
_PAYLOAD_COL = "tags[sentry.sdk_config.payload,string]"
_FIRST_SEEN_COL = "min(timestamp_precise)"


def _config_payload(traces_sample_rate: float) -> str:
    return json.dumps(
        {
            "version": 1,
            "sdk": {"name": "sentry.javascript.react", "version": "11.14.0", "settings": {}},
            "options": {"tracesSampleRate": traces_sample_rate, "dsn": "https://k@o1/1"},
            "options_set_by_user": ["tracesSampleRate"],
            "integrations": [{"name": "BrowserTracing"}],
            "release": "frontend@aaaa",
            "environment": "control",
        }
    )


# Two distinct configs: a sampling drop between them. Keyed by hash.
_PAYLOADS = {"h1": _config_payload(0.2), "h2": _config_payload(0.1)}


def _fake_run_table_query_for(project_ids: list[int]) -> Any:
    """Build a run_table_query stand-in whose timeline rows are keyed to real project ids."""

    def _fake(**kwargs: Any) -> dict[str, Any]:
        if kwargs["referrer"] == _TIMELINE_REFERRER:
            # One (project, hash) row per config per project; h2 is newer so transition is h1->h2.
            rows = []
            for project_id in project_ids:
                rows.append(
                    {_PROJECT_COL: project_id, _HASH_COL: "h1", _FIRST_SEEN_COL: 1_795_000_000.0}
                )
                rows.append(
                    {_PROJECT_COL: project_id, _HASH_COL: "h2", _FIRST_SEEN_COL: 1_795_010_000.0}
                )
            return {"data": rows, "meta": {}, "confidence": []}
        # Payload fetch: the hash is quoted in the query string.
        query = kwargs["query_string"]
        for hash_value, payload in _PAYLOADS.items():
            if f'"{hash_value}"' in query:
                return {"data": [{_PAYLOAD_COL: payload}], "meta": {}, "confidence": []}
        return {"data": [], "meta": {}, "confidence": []}

    return _fake


class SdkConfigAnnotationProducerTest(APITestCase):
    endpoint = "sentry-api-0-organization-timeseries-annotations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.project = self.create_project(organization=self.organization)

    def _get(self, project_ids: list[int] | None = None, **params: Any) -> Any:
        ids = project_ids if project_ids is not None else [self.project.id]
        with patch(
            "sentry.timeseries_annotations.producers.sdk_config_change.TraceMetrics.run_table_query",
            side_effect=_fake_run_table_query_for(ids),
        ):
            return self.get_success_response(
                self.organization.slug,
                project=ids,
                statsPeriod="14d",
                **params,
            )

    def _with_flags(self) -> Any:
        return self.feature(
            {
                "organizations:timeseries-annotations": True,
                "organizations:timeseries-annotations-usecase-sdk-config-experimental": True,
            }
        )

    def test_transition_creates_and_serves_annotation(self) -> None:
        with self._with_flags():
            response = self._get()
        rows = [r for r in response.data if r["annotationType"] == "sdk_config_change_experimental"]
        assert len(rows) == 1
        row = rows[0]
        assert row["projectId"] == str(self.project.id)
        assert row["description"] == "SDK config changed: tracesSampleRate 0.2 → 0.1"
        assert row["tags"]["changed_keys"] == ["options.tracesSampleRate"]
        assert row["createdByLabel"] == "sdk-config-producer"

    def test_idempotent_on_repeat(self) -> None:
        with self._with_flags():
            self._get()
            self._get()
        assert (
            TimeseriesAnnotation.objects.filter(
                organization_id=self.organization.id,
                annotation_type=AnnotationType.SDK_CONFIG_CHANGE_EXPERIMENTAL,
            ).count()
            == 1
        )

    def test_type_filter_excludes_config_annotations(self) -> None:
        with self._with_flags():
            response = self._get(annotationType="sentry_outage")
        assert response.data == []
        # The annotation was still created, just filtered out of this response.
        assert TimeseriesAnnotation.objects.filter(
            annotation_type=AnnotationType.SDK_CONFIG_CHANGE_EXPERIMENTAL
        ).exists()

    def test_disabled_without_usecase_flag(self) -> None:
        with self.feature({"organizations:timeseries-annotations": True}):
            with patch(
                "sentry.timeseries_annotations.producers.sdk_config_change.TraceMetrics.run_table_query",
                side_effect=_fake_run_table_query_for([self.project.id]),
            ) as mock_query:
                response = self.get_success_response(
                    self.organization.slug, project=self.project.id, statsPeriod="14d"
                )
        assert response.data == []
        assert mock_query.call_count == 0

    def test_producer_failure_does_not_break_list(self) -> None:
        with self._with_flags():
            with patch(
                "sentry.timeseries_annotations.producers.sdk_config_change.TraceMetrics.run_table_query",
                side_effect=Exception("snuba is down"),
            ):
                response = self.get_success_response(
                    self.organization.slug, project=self.project.id, statsPeriod="14d"
                )
        # Best-effort: the list still returns, just without derived annotations.
        assert response.data == []

    def test_multi_project_one_timeline_query_shared_payloads(self) -> None:
        # Two projects on the same two configs: one timeline query covers both, and each
        # distinct hash's payload is fetched once (deduped org-wide), not once per project.
        other = self.create_project(organization=self.organization)
        with self._with_flags():
            with patch(
                "sentry.timeseries_annotations.producers.sdk_config_change.TraceMetrics.run_table_query",
                side_effect=_fake_run_table_query_for([self.project.id, other.id]),
            ) as mock_query:
                response = self.get_success_response(
                    self.organization.slug,
                    project=[self.project.id, other.id],
                    statsPeriod="14d",
                )
        # One annotation per project.
        config_rows = [
            r for r in response.data if r["annotationType"] == "sdk_config_change_experimental"
        ]
        assert {r["projectId"] for r in config_rows} == {
            str(self.project.id),
            str(other.id),
        }
        # 1 timeline query + 1 payload query per distinct hash (h1, h2) = 3, regardless of
        # the two projects sharing those configs.
        assert mock_query.call_count == 3

    def test_single_config_project_skips_payload_fetch(self) -> None:
        # A project that sat on one config all window has no transition; its payload is never
        # fetched. Only the timeline query runs.
        def _one_hash(**kwargs: Any) -> dict[str, Any]:
            if kwargs["referrer"] == _TIMELINE_REFERRER:
                return {
                    "data": [
                        {
                            _PROJECT_COL: self.project.id,
                            _HASH_COL: "h1",
                            _FIRST_SEEN_COL: 1_795_000_000.0,
                        }
                    ],
                    "meta": {},
                    "confidence": [],
                }
            raise AssertionError("payload should not be fetched for a single-config project")

        with self._with_flags():
            with patch(
                "sentry.timeseries_annotations.producers.sdk_config_change.TraceMetrics.run_table_query",
                side_effect=_one_hash,
            ) as mock_query:
                response = self.get_success_response(
                    self.organization.slug, project=self.project.id, statsPeriod="14d"
                )
        assert response.data == []
        assert mock_query.call_count == 1  # timeline only, no payload fetch
