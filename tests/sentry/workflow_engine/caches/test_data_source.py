from unittest.mock import patch

from sentry.incidents.grouptype import MetricIssue
from sentry.workflow_engine.caches.data_source import (
    CACHE_TTL,
    _data_sources_by_detector_and_source_id,
    _DataSourceCacheKey,
    get_data_sources_by_detector_and_source_id,
)
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestGetDataSourcesByDetectorAndSourceId(BaseWorkflowTest):
    def test_get_data_sources_by_detector_and_source_id__single_data_source(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")

        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector])

        with self.assertNumQueries(1):
            result = get_data_sources_by_detector_and_source_id(detector.id, "12345")

            assert len(result) == 1
            assert result[0].id == data_source.id

    def test_get_data_sources_by_detector_and_source_id__multiple_data_sources(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")

        # The unique constraint is on (type, source_id), so a detector can have one data source
        # per type for the same source id
        data_source = self.create_data_source(source_id="12345", type="test")
        other_data_source = self.create_data_source(source_id="12345")

        data_source.detectors.set([detector])
        other_data_source.detectors.set([detector])

        result = get_data_sources_by_detector_and_source_id(detector.id, "12345")

        assert len(result) == 2
        assert {data_source.id for data_source in result} == {
            data_source.id,
            other_data_source.id,
        }

    def test_get_data_sources_by_detector_and_source_id__not_found(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")

        assert get_data_sources_by_detector_and_source_id(detector.id, "nonexistent") == []

    def test_get_data_sources_by_detector_and_source_id__wrong_detector(self) -> None:
        # Using MetricIssue detector type so that we're able to have two detectors on the same project
        detector = self.create_detector(
            project=self.project, name="Test Detector", type=MetricIssue.slug
        )

        other_detector = self.create_detector(
            project=self.project, name="Other Detector", type=MetricIssue.slug
        )

        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector])

        # Querying with a detector that is not associated with the data source should not find it
        assert get_data_sources_by_detector_and_source_id(other_detector.id, "12345") == []

    def test_get_data_sources_by_detector_and_source_id__cache_miss(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")

        data_source = self.create_data_source(source_id="12345", type="test")
        data_source.detectors.set([detector])

        with (
            patch("sentry.utils.cache.cache.get") as mock_cache_get,
            patch("sentry.utils.cache.cache.set") as mock_cache_set,
        ):
            mock_cache_get.return_value = None

            result = get_data_sources_by_detector_and_source_id(detector.id, "12345")

            assert len(result) == 1
            assert result[0].id == data_source.id

            expected_cache_key = _data_sources_by_detector_and_source_id.key(
                _DataSourceCacheKey(detector.id, "12345")
            )

            mock_cache_get.assert_called_once_with(expected_cache_key)
            mock_cache_set.assert_called_once()

            call_args = mock_cache_set.call_args
            assert call_args[0][0] == expected_cache_key

            cached_data_sources = call_args[0][1]
            assert len(cached_data_sources) == 1
            assert cached_data_sources[0].id == data_source.id
            assert call_args[0][2] == CACHE_TTL

    def test_get_data_sources_by_detector_and_source_id__cache_hit(self) -> None:
        detector = self.create_detector(project=self.project, name="Test Detector")

        data_source = self.create_data_source(source_id="12345", type="test")
        cached_data_sources = [data_source]

        with patch("sentry.utils.cache.cache.get") as mock_cache_get:
            mock_cache_get.return_value = cached_data_sources

            result = get_data_sources_by_detector_and_source_id(detector.id, "12345")

            assert result == cached_data_sources

            expected_cache_key = _data_sources_by_detector_and_source_id.key(
                _DataSourceCacheKey(detector.id, "12345")
            )

            mock_cache_get.assert_called_once_with(expected_cache_key)
