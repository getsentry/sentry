from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.compare import (
    _should_skip_diff_item_comparison,
    compare_size_analysis,
)
from sentry.preprod.size_analysis.insight_models import (
    DuplicateFilesInsightResult,
    FileSavingsResult,
    FileSavingsResultGroup,
    LargeImageFileInsightResult,
    WebPOptimizationInsightResult,
)
from sentry.preprod.size_analysis.models import (
    AndroidInsightResults,
    AppleInsightResults,
    ComparisonResults,
    DiffType,
    FileAnalysis,
    FileInfo,
    SizeAnalysisResults,
    SizeMetricDiffItem,
    TreemapElement,
    TreemapResults,
)
from sentry.testutils.cases import TestCase


class CompareSizeAnalysisTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _create_treemap_element(self, name, size, path=None, children=None, element_type="files"):
        return TreemapElement(
            name=name,
            size=size,
            path=path,
            is_dir=children is not None,
            type=element_type,
            children=children or [],
        )

    def _create_file_info(self, path: str, hash_value: str, children=None) -> FileInfo:
        return FileInfo(path=path, hash=hash_value, children=children or [])

    def _create_size_analysis_results(
        self,
        download_size=500,
        install_size=1000,
        treemap_root=None,
        file_analysis=None,
        analysis_version=None,
    ):
        treemap = None
        if treemap_root:
            treemap = TreemapResults(
                root=treemap_root,
                file_count=1,
                category_breakdown={},
                platform="test",
            )

        return SizeAnalysisResults(
            analysis_duration=1.0,
            download_size=download_size,
            install_size=install_size,
            treemap=treemap,
            file_analysis=file_analysis,
            analysis_version=analysis_version,
        )

    def test_compare_size_analysis_no_treemaps(self):
        """Test compare_size_analysis with no treemap data."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=2000,
            max_download_size=1000,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        head_results = self._create_size_analysis_results(download_size=1000, install_size=2000)
        base_results = self._create_size_analysis_results(download_size=800, install_size=1500)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert isinstance(result, ComparisonResults)
        assert result.diff_items == []
        assert isinstance(result.size_metric_diff_item, SizeMetricDiffItem)
        assert result.size_metric_diff_item.head_install_size == 2000
        assert result.size_metric_diff_item.head_download_size == 1000
        assert result.size_metric_diff_item.base_install_size == 1500
        assert result.size_metric_diff_item.base_download_size == 800

    def test_compare_size_analysis_file_added(self):
        """Test compare_size_analysis with a file added."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Head has one file, base has none
        head_treemap = self._create_treemap_element("file.txt", 100)
        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results()

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.diff_items) == 1
        diff_item = result.diff_items[0]
        assert diff_item.path == "file.txt"
        assert diff_item.size_diff == 100
        assert diff_item.head_size == 100
        assert diff_item.base_size is None
        assert diff_item.type == DiffType.ADDED

    def test_compare_size_analysis_file_removed(self):
        """Test compare_size_analysis with a file removed."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Base has one file, head has none
        base_treemap = self._create_treemap_element("file.txt", 100)
        head_results = self._create_size_analysis_results()
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.diff_items) == 1
        diff_item = result.diff_items[0]
        assert diff_item.path == "file.txt"
        assert diff_item.size_diff == -100
        assert diff_item.head_size is None
        assert diff_item.base_size == 100
        assert diff_item.type == DiffType.REMOVED

    def test_compare_size_analysis_file_increased(self):
        """Test compare_size_analysis with a file size increased."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Same file, different sizes
        head_treemap = self._create_treemap_element("file.txt", 150)
        base_treemap = self._create_treemap_element("file.txt", 100)
        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.diff_items) == 1
        diff_item = result.diff_items[0]
        assert diff_item.path == "file.txt"
        assert diff_item.size_diff == 50
        assert diff_item.head_size == 150
        assert diff_item.base_size == 100
        assert diff_item.type == DiffType.INCREASED

    def test_compare_size_analysis_file_decreased(self):
        """Test compare_size_analysis with a file size decreased."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Same file, different sizes
        head_treemap = self._create_treemap_element("file.txt", 50)
        base_treemap = self._create_treemap_element("file.txt", 100)
        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.diff_items) == 1
        diff_item = result.diff_items[0]
        assert diff_item.path == "file.txt"
        assert diff_item.size_diff == -50
        assert diff_item.head_size == 50
        assert diff_item.base_size == 100
        assert diff_item.type == DiffType.DECREASED

    def test_compare_size_analysis_file_unchanged(self):
        """Test compare_size_analysis with a file size unchanged (should be skipped)."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Same file, same size
        head_treemap = self._create_treemap_element("file.txt", 100)
        base_treemap = self._create_treemap_element("file.txt", 100)
        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Should skip files with no size difference
        assert len(result.diff_items) == 0

    def test_compare_size_analysis_multiple_files(self):
        """Test compare_size_analysis with multiple files."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Head has file1 (increased), file2 (new), file3 (removed from base)
        # Base has file1 (original), file3 (removed from head)
        head_treemap = self._create_treemap_element(
            "dir",
            0,
            children=[
                self._create_treemap_element("file1.txt", 150),  # increased from 100
                self._create_treemap_element("file2.txt", 200),  # new file
            ],
        )
        base_treemap = self._create_treemap_element(
            "dir",
            0,
            children=[
                self._create_treemap_element("file1.txt", 100),  # original size
                self._create_treemap_element("file3.txt", 300),  # removed file
            ],
        )
        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.diff_items) == 3

        # Sort by path for consistent testing
        diff_items = sorted(result.diff_items, key=lambda x: x.path)

        # file1.txt - increased
        assert diff_items[0].path == "dir/file1.txt"
        assert diff_items[0].size_diff == 50
        assert diff_items[0].type == DiffType.INCREASED

        # file2.txt - added
        assert diff_items[1].path == "dir/file2.txt"
        assert diff_items[1].size_diff == 200
        assert diff_items[1].type == DiffType.ADDED

        # file3.txt - removed
        assert diff_items[2].path == "dir/file3.txt"
        assert diff_items[2].size_diff == -300
        assert diff_items[2].type == DiffType.REMOVED

    def test_compare_size_analysis_zero_size_diffs_skipped(self):
        """Test that zero size diffs are skipped for all diff types."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Test added file with zero size
        head_treemap = self._create_treemap_element("file1.txt", 0)
        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results()

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)
        assert len(result.diff_items) == 0

        # Test removed file with zero size
        base_treemap = self._create_treemap_element("file2.txt", 0)
        head_results = self._create_size_analysis_results()
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)
        assert len(result.diff_items) == 0

    def test_compare_size_analysis_different_artifact_types(self):
        """Test compare_size_analysis with different artifact types."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            max_install_size=1500,
            max_download_size=800,
        )

        head_results = self._create_size_analysis_results()
        base_results = self._create_size_analysis_results()

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert (
            result.size_metric_diff_item.metrics_artifact_type
            == PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT
        )
        assert result.size_metric_diff_item.identifier == "watch"

    def test_compare_size_analysis_complex_nested_structure(self):
        """Test compare_size_analysis with complex nested directory structure."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.WATCH_ARTIFACT,
            identifier="watch",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="main",
            max_install_size=1500,
            max_download_size=800,
        )

        # Complex nested structure
        head_treemap = self._create_treemap_element(
            "app",
            0,
            children=[
                self._create_treemap_element(
                    "src",
                    0,
                    children=[
                        self._create_treemap_element("main.js", 500),
                        self._create_treemap_element("utils.js", 200),
                    ],
                ),
                self._create_treemap_element(
                    "assets",
                    0,
                    children=[
                        self._create_treemap_element("logo.png", 100),
                    ],
                ),
            ],
        )
        base_treemap = self._create_treemap_element(
            "app",
            0,
            children=[
                self._create_treemap_element(
                    "src",
                    0,
                    children=[
                        self._create_treemap_element("main.js", 400),  # increased
                        # utils.js removed
                    ],
                ),
                # assets directory removed
            ],
        )

        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.diff_items) == 3

        # Sort by path for consistent testing
        diff_items = sorted(result.diff_items, key=lambda x: x.path)

        # app/assets/logo.png - added
        assert diff_items[0].path == "app/assets/logo.png"
        assert diff_items[0].size_diff == 100
        assert diff_items[0].type == DiffType.ADDED

        # app/src/main.js - increased
        assert diff_items[1].path == "app/src/main.js"
        assert diff_items[1].size_diff == 100
        assert diff_items[1].type == DiffType.INCREASED

        # app/src/utils.js - added
        assert diff_items[2].path == "app/src/utils.js"
        assert diff_items[2].size_diff == 200
        assert diff_items[2].type == DiffType.ADDED

    def test_compare_size_analysis_duplicate_paths(self):
        """Test compare_size_analysis with duplicate paths (e.g., Assets.car with multiple entries)."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Simulate Assets.car with duplicate image files
        # Head has more duplicates than base
        head_treemap = self._create_treemap_element(
            "Assets.car",
            4788224,
            path="Assets.car",
            children=[
                self._create_treemap_element("AppIcon", 4096, path="Assets.car/AppIcon"),
                self._create_treemap_element(
                    "Primary-Light@2x.png", 507904, path="Assets.car/Primary-Light@2x.png"
                ),
                self._create_treemap_element(
                    "Primary-Light@2x.png", 802816, path="Assets.car/Primary-Light@2x.png"
                ),
                self._create_treemap_element("AppIcon", 4096, path="Assets.car/AppIcon"),
                self._create_treemap_element(
                    "Primary-Light@2x.png", 507904, path="Assets.car/Primary-Light@2x.png"
                ),
                self._create_treemap_element(
                    "Primary-Light@2x.png", 802816, path="Assets.car/Primary-Light@2x.png"
                ),
                self._create_treemap_element(
                    "Primary-Dark@2x.png", 339968, path="Assets.car/Primary-Dark@2x.png"
                ),
                self._create_treemap_element(
                    "Primary-Dark@2x.png", 462848, path="Assets.car/Primary-Dark@2x.png"
                ),
            ],
        )
        base_treemap = self._create_treemap_element(
            "Assets.car",
            2404352,
            path="Assets.car",
            children=[
                self._create_treemap_element("AppIcon", 4096, path="Assets.car/AppIcon"),
                self._create_treemap_element(
                    "Primary-Light@2x.png", 507904, path="Assets.car/Primary-Light@2x.png"
                ),
                self._create_treemap_element(
                    "Primary-Light@2x.png", 802816, path="Assets.car/Primary-Light@2x.png"
                ),
                self._create_treemap_element(
                    "Primary-Dark@2x.png", 339968, path="Assets.car/Primary-Dark@2x.png"
                ),
                self._create_treemap_element(
                    "Primary-Dark@2x.png", 462848, path="Assets.car/Primary-Dark@2x.png"
                ),
            ],
        )

        head_results = self._create_size_analysis_results(treemap_root=head_treemap)
        base_results = self._create_size_analysis_results(treemap_root=base_treemap)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Should detect added files: 1 AppIcon, 2 Primary-Light@2x.png
        assert len(result.diff_items) == 3

        # Sort by path and size for consistent testing
        diff_items = sorted(result.diff_items, key=lambda x: (x.path, x.size_diff))

        # Assets.car/AppIcon - added (1 extra copy)
        assert diff_items[0].path == "Assets.car/AppIcon"
        assert diff_items[0].size_diff == 4096
        assert diff_items[0].type == DiffType.ADDED

        # Assets.car/Primary-Light@2x.png - added (2 extra copies)
        assert diff_items[1].path == "Assets.car/Primary-Light@2x.png"
        assert diff_items[1].size_diff == 507904
        assert diff_items[1].type == DiffType.ADDED

        assert diff_items[2].path == "Assets.car/Primary-Light@2x.png"
        assert diff_items[2].size_diff == 802816
        assert diff_items[2].type == DiffType.ADDED


class ShouldSkipDiffItemComparisonTest(TestCase):
    def _create_size_analysis_results(self, analysis_version=None):
        """Helper to create SizeAnalysisResults with specified analysis_version."""
        return SizeAnalysisResults(
            analysis_duration=1.0,
            download_size=500,
            install_size=1000,
            treemap=None,
            analysis_version=analysis_version,
        )

    def test_skip_on_major_version_mismatch(self):
        """Should skip diff comparison when major versions differ."""
        head_results = self._create_size_analysis_results(analysis_version="2.0.0")
        base_results = self._create_size_analysis_results(analysis_version="1.0.0")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is True

    def test_skip_on_minor_version_mismatch(self):
        """Should skip diff comparison when minor versions differ."""
        head_results = self._create_size_analysis_results(analysis_version="1.2.0")
        base_results = self._create_size_analysis_results(analysis_version="1.1.0")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is True

    def test_no_skip_on_patch_version_mismatch(self):
        """Should NOT skip diff comparison when only patch versions differ."""
        head_results = self._create_size_analysis_results(analysis_version="1.0.1")
        base_results = self._create_size_analysis_results(analysis_version="1.0.0")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_no_skip_on_same_versions(self):
        """Should NOT skip diff comparison when versions are identical."""
        head_results = self._create_size_analysis_results(analysis_version="1.2.3")
        base_results = self._create_size_analysis_results(analysis_version="1.2.3")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_no_skip_when_head_version_missing(self):
        """Should NOT skip diff comparison when head version is None."""
        head_results = self._create_size_analysis_results(analysis_version=None)
        base_results = self._create_size_analysis_results(analysis_version="1.0.0")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_no_skip_when_base_version_missing(self):
        """Should NOT skip diff comparison when base version is None."""
        head_results = self._create_size_analysis_results(analysis_version="1.0.0")
        base_results = self._create_size_analysis_results(analysis_version=None)

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_no_skip_when_both_versions_missing(self):
        """Should NOT skip diff comparison when both versions are None."""
        head_results = self._create_size_analysis_results(analysis_version=None)
        base_results = self._create_size_analysis_results(analysis_version=None)

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_no_skip_on_invalid_head_version(self):
        """Should NOT skip diff comparison when head version is invalid."""
        head_results = self._create_size_analysis_results(analysis_version="invalid-version")
        base_results = self._create_size_analysis_results(analysis_version="1.0.0")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_no_skip_on_invalid_base_version(self):
        """Should NOT skip diff comparison when base version is invalid."""
        head_results = self._create_size_analysis_results(analysis_version="1.0.0")
        base_results = self._create_size_analysis_results(analysis_version="not-a-version")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_no_skip_when_both_versions_invalid(self):
        """Should NOT skip diff comparison when both versions are invalid."""
        head_results = self._create_size_analysis_results(analysis_version="bad-version")
        base_results = self._create_size_analysis_results(analysis_version="also-bad")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False

    def test_skip_with_prerelease_versions(self):
        """Should skip when major/minor differ even with pre-release tags."""
        head_results = self._create_size_analysis_results(analysis_version="2.0.0-alpha")
        base_results = self._create_size_analysis_results(analysis_version="1.0.0-beta")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is True

    def test_no_skip_with_same_major_minor_prerelease(self):
        """Should NOT skip when major/minor match despite different pre-release tags."""
        head_results = self._create_size_analysis_results(analysis_version="1.2.0-alpha")
        base_results = self._create_size_analysis_results(analysis_version="1.2.0-beta")

        result = _should_skip_diff_item_comparison(head_results, base_results)

        assert result is False


class CompareWithVersionSkippingTest(CompareSizeAnalysisTest):
    def test_compare_skips_diff_items_on_major_version_mismatch(self):
        """Integration test: diff items should be skipped when major versions differ."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=2000,
            max_download_size=1000,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Create treemaps with differences
        head_treemap = self._create_treemap_element("file.txt", 150)
        base_treemap = self._create_treemap_element("file.txt", 100)

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, analysis_version="2.0.0"
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, analysis_version="1.0.0"
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Diff items should be empty due to version mismatch
        assert result.diff_items == []
        assert result.skipped_diff_item_comparison is True
        assert result.head_analysis_version == "2.0.0"
        assert result.base_analysis_version == "1.0.0"
        # Size metrics should still be populated
        assert result.size_metric_diff_item.head_install_size == 2000
        assert result.size_metric_diff_item.base_install_size == 1500

    def test_compare_skips_diff_items_on_minor_version_mismatch(self):
        """Integration test: diff items should be skipped when minor versions differ."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=2000,
            max_download_size=1000,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        head_treemap = self._create_treemap_element("file.txt", 150)
        base_treemap = self._create_treemap_element("file.txt", 100)

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, analysis_version="1.2.0"
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, analysis_version="1.1.0"
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert result.diff_items == []
        assert result.skipped_diff_item_comparison is True
        assert result.head_analysis_version == "1.2.0"
        assert result.base_analysis_version == "1.1.0"

    def test_compare_includes_diff_items_on_patch_version_mismatch(self):
        """Integration test: diff items should be included when only patch versions differ."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=2000,
            max_download_size=1000,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        head_treemap = self._create_treemap_element("file.txt", 150)
        base_treemap = self._create_treemap_element("file.txt", 100)

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, analysis_version="1.0.2"
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, analysis_version="1.0.1"
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Diff items should be present since only patch version differs
        assert len(result.diff_items) == 1
        assert result.skipped_diff_item_comparison is False
        assert result.diff_items[0].size_diff == 50
        assert result.diff_items[0].type == DiffType.INCREASED


class CompareWithRenameDetectionTest(CompareSizeAnalysisTest):
    def test_renamed_file_excluded_from_diff(self):
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        head_treemap = self._create_treemap_element(
            "new_name.txt", 100, path="new_name.txt", element_type="files"
        )
        base_treemap = self._create_treemap_element(
            "old_name.txt", 100, path="old_name.txt", element_type="files"
        )

        head_file_analysis = FileAnalysis(
            items=[self._create_file_info("new_name.txt", "same_hash")]
        )
        base_file_analysis = FileAnalysis(
            items=[self._create_file_info("old_name.txt", "same_hash")]
        )

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, file_analysis=head_file_analysis
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, file_analysis=base_file_analysis
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.diff_items) == 0

    def test_mixed_renames_and_real_changes(self):
        """Test rename detection with mix of renamed and actually changed files."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Head has:
        # - renamed_new.txt (renamed from renamed_old.txt - same hash)
        # - actually_new.txt (truly new file)
        head_treemap = self._create_treemap_element(
            "root",
            0,
            children=[
                self._create_treemap_element(
                    "renamed_new.txt", 100, path="renamed_new.txt", element_type="files"
                ),
                self._create_treemap_element(
                    "actually_new.txt", 200, path="actually_new.txt", element_type="files"
                ),
            ],
        )

        # Base has:
        # - renamed_old.txt (will be renamed to renamed_new.txt)
        # - actually_removed.txt (truly removed file)
        base_treemap = self._create_treemap_element(
            "root",
            0,
            children=[
                self._create_treemap_element(
                    "renamed_old.txt", 100, path="renamed_old.txt", element_type="files"
                ),
                self._create_treemap_element(
                    "actually_removed.txt", 300, path="actually_removed.txt", element_type="files"
                ),
            ],
        )

        head_file_analysis = FileAnalysis(
            items=[
                self._create_file_info("renamed_new.txt", "rename_hash"),
                self._create_file_info("actually_new.txt", "new_hash"),
            ]
        )
        base_file_analysis = FileAnalysis(
            items=[
                self._create_file_info("renamed_old.txt", "rename_hash"),
                self._create_file_info("actually_removed.txt", "removed_hash"),
            ]
        )

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, file_analysis=head_file_analysis
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, file_analysis=base_file_analysis
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Should only have 2 diff items: actually_new (added) and actually_removed (removed)
        # The renamed file should be excluded
        assert len(result.diff_items) == 2

        diff_items = sorted(result.diff_items, key=lambda x: x.path)

        assert diff_items[0].path == "actually_new.txt"
        assert diff_items[0].type == DiffType.ADDED
        assert diff_items[0].size_diff == 200

        assert diff_items[1].path == "actually_removed.txt"
        assert diff_items[1].type == DiffType.REMOVED
        assert diff_items[1].size_diff == -300

    def test_no_file_analysis_falls_back_to_default_behavior(self):
        """Test that when file_analysis is None, default behavior is used."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Files at different paths, no file_analysis to detect rename
        head_treemap = self._create_treemap_element(
            "new_name.txt", 100, path="new_name.txt", element_type="files"
        )
        base_treemap = self._create_treemap_element(
            "old_name.txt", 100, path="old_name.txt", element_type="files"
        )

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, file_analysis=None
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, file_analysis=None
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Without file_analysis, both should appear as added/removed
        assert len(result.diff_items) == 2
        types = {item.type for item in result.diff_items}
        assert types == {DiffType.ADDED, DiffType.REMOVED}

    def test_rename_with_duplication_shows_additions(self):
        """Test that when a file is renamed AND duplicated, only one rename is detected.

        Scenario: Base has 1 file, head has 3 files with same hash at different paths.
        Expected: 1 rename (excluded from diff), 2 additions shown.
        """
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Head has 3 copies of the same file in different frameworks
        head_treemap = self._create_treemap_element(
            "root",
            0,
            children=[
                self._create_treemap_element(
                    "resource.png", 100, path="Framework1/resource.png", element_type="files"
                ),
                self._create_treemap_element(
                    "resource.png", 100, path="Framework2/resource.png", element_type="files"
                ),
                self._create_treemap_element(
                    "resource.png", 100, path="Framework3/resource.png", element_type="files"
                ),
            ],
        )

        # Base has 1 copy at a different path
        base_treemap = self._create_treemap_element(
            "root",
            0,
            children=[
                self._create_treemap_element(
                    "resource.png", 100, path="OldFramework/resource.png", element_type="files"
                ),
            ],
        )

        # All files have the same hash
        head_file_analysis = FileAnalysis(
            items=[
                self._create_file_info("Framework1/resource.png", "same_hash"),
                self._create_file_info("Framework2/resource.png", "same_hash"),
                self._create_file_info("Framework3/resource.png", "same_hash"),
            ]
        )
        base_file_analysis = FileAnalysis(
            items=[
                self._create_file_info("OldFramework/resource.png", "same_hash"),
            ]
        )

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, file_analysis=head_file_analysis
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, file_analysis=base_file_analysis
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Should have 2 additions (3 head files - 1 rename = 2 additions)
        # The base file and one head file are detected as a rename and excluded
        assert len(result.diff_items) == 2

        # All should be additions
        for item in result.diff_items:
            assert item.type == DiffType.ADDED
            assert item.size_diff == 100

    def test_rename_selection_is_deterministic(self):
        """Test that rename selection is deterministic when multiple paths share the same hash.

        When multiple files on each side share the same hash, we need to deterministically
        select which paths are treated as renames vs additions/removals. This test verifies
        that selection is based on alphabetical ordering, not arbitrary set ordering.
        """
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Head has 3 files with same hash (z, a, m - intentionally not alphabetical)
        head_treemap = self._create_treemap_element(
            "root",
            0,
            children=[
                self._create_treemap_element("z.txt", 100, path="z.txt", element_type="files"),
                self._create_treemap_element("a.txt", 100, path="a.txt", element_type="files"),
                self._create_treemap_element("m.txt", 100, path="m.txt", element_type="files"),
            ],
        )

        # Base has 2 files with same hash (y, b - intentionally not alphabetical)
        base_treemap = self._create_treemap_element(
            "root",
            0,
            children=[
                self._create_treemap_element("y.txt", 100, path="y.txt", element_type="files"),
                self._create_treemap_element("b.txt", 100, path="b.txt", element_type="files"),
            ],
        )

        # All files have the same hash
        head_file_analysis = FileAnalysis(
            items=[
                self._create_file_info("z.txt", "same_hash"),
                self._create_file_info("a.txt", "same_hash"),
                self._create_file_info("m.txt", "same_hash"),
            ]
        )
        base_file_analysis = FileAnalysis(
            items=[
                self._create_file_info("y.txt", "same_hash"),
                self._create_file_info("b.txt", "same_hash"),
            ]
        )

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, file_analysis=head_file_analysis
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, file_analysis=base_file_analysis
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # With 3 head paths and 2 base paths, we should have:
        # - 2 renames (min(3, 2) = 2, excluded from diff)
        # - 1 addition (3 - 2 = 1)
        # The alphabetically-first paths should be selected as renames:
        # - Head: a.txt, m.txt (first 2 alphabetically) -> renames
        # - Base: b.txt, y.txt (first 2 alphabetically) -> renames
        # - z.txt should be the addition (alphabetically last on head side)
        assert len(result.diff_items) == 1
        assert result.diff_items[0].path == "z.txt"
        assert result.diff_items[0].type == DiffType.ADDED

    def test_duplicate_treemap_elements_at_renamed_path_all_skipped(self):
        """Test that duplicate treemap elements at a renamed path are all skipped.

        iOS Assets.car files can have duplicate treemap entries for the same image at the
        same path. These duplicates represent the same file, so when that file is detected
        as a rename, ALL duplicate treemap entries should be skipped - not just one.

        This is the primary use case: AppIcon images get renamed (UUID changes) between builds
        but the content is identical. The treemap may have multiple entries for the same icon.
        """
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Head has 2 IDENTICAL duplicate treemap elements at same path (same size = same file)
        # This simulates Assets.car having duplicate entries for the same image
        head_treemap = self._create_treemap_element(
            "Assets.car",
            200,
            path="Assets.car",
            children=[
                self._create_treemap_element(
                    "AppIcon_ABC123.png",
                    100,
                    path="Assets.car/AppIcon_ABC123.png",
                    element_type="assets",
                ),
                self._create_treemap_element(
                    "AppIcon_ABC123.png",
                    100,
                    path="Assets.car/AppIcon_ABC123.png",
                    element_type="assets",
                ),
            ],
        )

        # Base has 2 IDENTICAL duplicate treemap elements at a DIFFERENT path
        base_treemap = self._create_treemap_element(
            "Assets.car",
            200,
            path="Assets.car",
            children=[
                self._create_treemap_element(
                    "AppIcon_XYZ789.png",
                    100,
                    path="Assets.car/AppIcon_XYZ789.png",
                    element_type="assets",
                ),
                self._create_treemap_element(
                    "AppIcon_XYZ789.png",
                    100,
                    path="Assets.car/AppIcon_XYZ789.png",
                    element_type="assets",
                ),
            ],
        )

        # File analysis has only 1 entry per path (it's the same file, just duplicated in treemap)
        # Same hash = this is a rename
        head_file_analysis = FileAnalysis(
            items=[
                FileInfo(
                    path="Assets.car",
                    hash="parent_hash",
                    children=[
                        self._create_file_info("AppIcon_ABC123.png", "same_content_hash"),
                    ],
                ),
            ]
        )
        base_file_analysis = FileAnalysis(
            items=[
                FileInfo(
                    path="Assets.car",
                    hash="parent_hash",
                    children=[
                        self._create_file_info("AppIcon_XYZ789.png", "same_content_hash"),
                    ],
                ),
            ]
        )

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, file_analysis=head_file_analysis
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, file_analysis=base_file_analysis
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # ALL elements should be skipped because:
        # - The head path is detected as a rename (same hash exists at different base path)
        # - The duplicate treemap entries are identical, representing the same file
        # - Therefore all duplicates should be excluded from diff
        assert len(result.diff_items) == 0, (
            f"Expected 0 diff items (all duplicates at renamed path should be skipped), "
            f"got {len(result.diff_items)}. "
            "Bug: not all duplicate treemap elements are being skipped for renamed files."
        )

    def test_rename_detection_with_nested_children(self):
        """Test rename detection works with nested file_analysis children (e.g., Assets.car).

        Assets.car files contain nested images as children in file_analysis.
        Rename detection should work for these nested files.
        """
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1500,
            max_download_size=800,
        )

        # Treemap shows image moved from old Assets.car path to new path
        head_treemap = self._create_treemap_element(
            "Assets.car",
            100,
            path="Assets.car",
            children=[
                self._create_treemap_element(
                    "NewIcon.png", 100, path="Assets.car/NewIcon.png", element_type="assets"
                ),
            ],
        )
        base_treemap = self._create_treemap_element(
            "Assets.car",
            100,
            path="Assets.car",
            children=[
                self._create_treemap_element(
                    "OldIcon.png", 100, path="Assets.car/OldIcon.png", element_type="assets"
                ),
            ],
        )

        # File analysis has Assets.car with children - same hash means it's a rename
        head_assets_car = FileInfo(
            path="Assets.car",
            hash="parent_hash",
            children=[
                self._create_file_info("NewIcon.png", "icon_hash"),
            ],
        )
        base_assets_car = FileInfo(
            path="Assets.car",
            hash="parent_hash",
            children=[
                self._create_file_info("OldIcon.png", "icon_hash"),
            ],
        )

        head_file_analysis = FileAnalysis(items=[head_assets_car])
        base_file_analysis = FileAnalysis(items=[base_assets_car])

        head_results = self._create_size_analysis_results(
            treemap_root=head_treemap, file_analysis=head_file_analysis
        )
        base_results = self._create_size_analysis_results(
            treemap_root=base_treemap, file_analysis=base_file_analysis
        )

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # The renamed asset should be excluded - no diff items
        assert len(result.diff_items) == 0


class CompareInsightsTest(TestCase):

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _create_size_analysis_results(
        self,
        insights: AndroidInsightResults | AppleInsightResults | None = None,
        analysis_version="1.0.0",
    ):
        return SizeAnalysisResults(
            analysis_duration=1.0,
            download_size=500,
            install_size=1000,
            treemap=None,
            insights=insights,
            analysis_version=analysis_version,
        )

    def test_compare_insights_new_insight_in_head(self):
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Head has duplicate files insight, base has none
        head_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=500,
                groups=[
                    FileSavingsResultGroup(
                        name="image.png",
                        files=[FileSavingsResult(file_path="/path/image.png", total_savings=500)],
                        total_savings=500,
                    )
                ],
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=None)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 1
        insight_diff = result.insight_diff_items[0]
        assert insight_diff.insight_type == "duplicate_files"
        assert insight_diff.status == "new"
        assert insight_diff.total_savings_change == 500
        assert insight_diff.file_diffs == []
        assert len(insight_diff.group_diffs) == 1
        group_diff = insight_diff.group_diffs[0]
        assert group_diff.path == "image.png"
        assert group_diff.type.value == "added"
        assert group_diff.size_diff == 500

        # Check nested file diff
        assert group_diff.diff_items is not None
        assert len(group_diff.diff_items) == 1
        file_diff = group_diff.diff_items[0]
        assert file_diff.path == "/path/image.png"
        assert file_diff.type.value == "added"
        assert file_diff.size_diff == 500

    def test_compare_insights_resolved_insight_in_base(self):
        """Test that insights only in base are marked as 'resolved'."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Base has large images insight, head has none
        base_insights = AndroidInsightResults(
            duplicate_files=None,
            webp_optimization=None,
            large_images=LargeImageFileInsightResult(
                total_savings=2000,
                files=[FileSavingsResult(file_path="/path/large.png", total_savings=2000)],
            ),
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=None)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 1
        insight_diff = result.insight_diff_items[0]
        assert insight_diff.insight_type == "large_images"
        assert insight_diff.status == "resolved"
        assert insight_diff.total_savings_change == -2000
        assert len(insight_diff.file_diffs) == 1
        file_diff = insight_diff.file_diffs[0]
        assert file_diff.path == "/path/large.png"
        assert file_diff.type.value == "removed"
        assert file_diff.size_diff == -2000
        assert insight_diff.group_diffs == []

    def test_compare_insights_unresolved_insight_in_both(self):
        """Test that insights in both head and base are marked as 'unresolved'."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Both have webp_optimization insight with different savings
        head_insights = AndroidInsightResults(
            duplicate_files=None,
            webp_optimization=WebPOptimizationInsightResult(
                total_savings=1500,
                files=[FileSavingsResult(file_path="/path/image.png", total_savings=1500)],
            ),
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )
        base_insights = AndroidInsightResults(
            duplicate_files=None,
            webp_optimization=WebPOptimizationInsightResult(
                total_savings=1000,
                files=[FileSavingsResult(file_path="/path/image.png", total_savings=1000)],
            ),
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 1
        insight_diff = result.insight_diff_items[0]
        assert insight_diff.insight_type == "webp_optimization"
        assert insight_diff.status == "unresolved"
        assert insight_diff.total_savings_change == 500
        assert len(insight_diff.file_diffs) == 1
        file_diff = insight_diff.file_diffs[0]
        assert file_diff.path == "/path/image.png"
        assert file_diff.type.value == "increased"
        assert file_diff.size_diff == 500
        assert insight_diff.group_diffs == []

    def test_compare_insights_multiple_insights(self):
        """Test comparison with multiple insights in different states."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Head: duplicate_files (new), webp_optimization (unresolved)
        head_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=1000,
                groups=[
                    FileSavingsResultGroup(
                        name="image.png",
                        files=[FileSavingsResult(file_path="/path/image.png", total_savings=500)],
                        total_savings=500,
                    )
                ],
            ),
            webp_optimization=WebPOptimizationInsightResult(
                total_savings=1500,
                files=[FileSavingsResult(file_path="/path/photo.png", total_savings=1500)],
            ),
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )
        # Base: webp_optimization (unresolved), large_images (resolved)
        base_insights = AndroidInsightResults(
            duplicate_files=None,
            webp_optimization=WebPOptimizationInsightResult(
                total_savings=1000,
                files=[FileSavingsResult(file_path="/path/photo.png", total_savings=1000)],
            ),
            large_images=LargeImageFileInsightResult(
                total_savings=2000,
                files=[FileSavingsResult(file_path="/path/huge.png", total_savings=2000)],
            ),
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 3

        # Sort by insight_type for predictable testing
        insight_diffs = sorted(result.insight_diff_items, key=lambda x: x.insight_type)

        # duplicate_files - new
        assert insight_diffs[0].insight_type == "duplicate_files"
        assert insight_diffs[0].status == "new"

        # large_images - resolved
        assert insight_diffs[1].insight_type == "large_images"
        assert insight_diffs[1].status == "resolved"

        # webp_optimization - unresolved
        assert insight_diffs[2].insight_type == "webp_optimization"
        assert insight_diffs[2].status == "unresolved"

    def test_compare_insights_zero_savings_excluded(self):
        """Test that insights with zero total_savings are excluded."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Both have insights but with zero savings
        head_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(total_savings=0, groups=[]),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )
        base_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(total_savings=0, groups=[]),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Should have no insight diff items since all have zero savings
        assert len(result.insight_diff_items) == 0

    def test_compare_insights_version_mismatch_skips_comparison(self):
        """Test that insight comparison is skipped when analysis versions mismatch."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Head has insights
        head_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=1000,
                groups=[
                    FileSavingsResultGroup(
                        name="image.png",
                        files=[FileSavingsResult(file_path="/path/image.png", total_savings=500)],
                        total_savings=500,
                    )
                ],
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        # Version mismatch: major version differs
        head_results = self._create_size_analysis_results(
            insights=head_insights, analysis_version="2.0.0"
        )
        base_results = self._create_size_analysis_results(insights=None, analysis_version="1.0.0")

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # Insight comparison should be skipped
        assert len(result.insight_diff_items) == 0
        assert result.skipped_diff_item_comparison is True

    def test_compare_insights_apple_platform(self):
        """Test insight comparison works with Apple platform insights."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Apple insights with different fields than Android
        head_insights = AppleInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=1000,
                groups=[
                    FileSavingsResultGroup(
                        name="icon.png",
                        files=[FileSavingsResult(file_path="/path/icon.png", total_savings=500)],
                        total_savings=500,
                    )
                ],
            ),
            large_images=None,
            large_audios=None,
            large_videos=None,
            strip_binary=None,
            localized_strings_minify=None,
            small_files=None,
            loose_images=None,
            hermes_debug_info=None,
            image_optimization=None,
            main_binary_exported_symbols=None,
            unnecessary_files=None,
            audio_compression=None,
            video_compression=None,
            alternate_icons_optimization=None,
        )
        base_insights = AppleInsightResults(
            duplicate_files=None,
            large_images=LargeImageFileInsightResult(
                total_savings=3000,
                files=[FileSavingsResult(file_path="/path/background.png", total_savings=3000)],
            ),
            large_audios=None,
            large_videos=None,
            strip_binary=None,
            localized_strings_minify=None,
            small_files=None,
            loose_images=None,
            hermes_debug_info=None,
            image_optimization=None,
            main_binary_exported_symbols=None,
            unnecessary_files=None,
            audio_compression=None,
            video_compression=None,
            alternate_icons_optimization=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 2

        # Sort by insight_type for predictable testing
        insight_diffs = sorted(result.insight_diff_items, key=lambda x: x.insight_type)

        # duplicate_files - new (Apple specific)
        assert insight_diffs[0].insight_type == "duplicate_files"
        assert insight_diffs[0].status == "new"

        # large_images - resolved (Apple specific)
        assert insight_diffs[1].insight_type == "large_images"
        assert insight_diffs[1].status == "resolved"

    def test_compare_insights_files_insight_with_diffs(self):
        """Test FilesInsightResult with file-level differences."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Head has 3 files, base has 2 (1 modified, 1 added, 1 removed)
        head_insights = AndroidInsightResults(
            duplicate_files=None,
            webp_optimization=WebPOptimizationInsightResult(
                total_savings=3500,
                files=[
                    FileSavingsResult(file_path="/path/image1.png", total_savings=1500),
                    FileSavingsResult(file_path="/path/image2.png", total_savings=2000),
                    FileSavingsResult(file_path="/path/image3.png", total_savings=1500),
                    FileSavingsResult(file_path="/path/image4.png", total_savings=1500),
                ],
            ),
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )
        base_insights = AndroidInsightResults(
            duplicate_files=None,
            webp_optimization=WebPOptimizationInsightResult(
                total_savings=2500,
                files=[
                    FileSavingsResult(file_path="/path/image1.png", total_savings=1000),
                    FileSavingsResult(file_path="/path/image3.png", total_savings=1500),
                ],
            ),
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 1
        insight_diff = result.insight_diff_items[0]
        assert insight_diff.insight_type == "webp_optimization"
        assert insight_diff.status == "unresolved"
        assert insight_diff.total_savings_change == 1000

        # Check file-level diffs
        # Note: unchanged files (image3.png) are now skipped in diffs
        assert len(insight_diff.file_diffs) == 3
        file_diffs_by_path = {d.path: d for d in insight_diff.file_diffs}

        # image1.png - increased (1000 -> 1500)
        assert file_diffs_by_path["/path/image1.png"].type.value == "increased"
        assert file_diffs_by_path["/path/image1.png"].size_diff == 500

        # image2.png - added
        assert file_diffs_by_path["/path/image2.png"].type.value == "added"
        assert file_diffs_by_path["/path/image2.png"].size_diff == 2000

        # image4.png - added (not in base, only in head)
        assert file_diffs_by_path["/path/image4.png"].type.value == "added"
        assert file_diffs_by_path["/path/image4.png"].size_diff == 1500

    def test_compare_insights_groups_insight_with_diffs(self):
        """Test GroupsInsightResult with group-level differences."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Head has 2 groups, base has 2 groups (1 modified, 1 different)
        head_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=4000,
                groups=[
                    FileSavingsResultGroup(
                        name="icon.png",
                        files=[FileSavingsResult(file_path="/a/icon.png", total_savings=500)],
                        total_savings=1500,
                    ),
                    FileSavingsResultGroup(
                        name="icon2.png",
                        files=[FileSavingsResult(file_path="/a/icon2.png", total_savings=500)],
                        total_savings=1500,
                    ),
                    FileSavingsResultGroup(
                        name="logo.png",
                        files=[FileSavingsResult(file_path="/b/logo.png", total_savings=500)],
                        total_savings=2500,
                    ),
                ],
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )
        base_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=3000,
                groups=[
                    FileSavingsResultGroup(
                        name="icon.png",
                        files=[FileSavingsResult(file_path="/a/icon.png", total_savings=500)],
                        total_savings=1000,
                    ),
                    FileSavingsResultGroup(
                        name="banner.png",
                        files=[FileSavingsResult(file_path="/c/banner.png", total_savings=500)],
                        total_savings=2000,
                    ),
                ],
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 1
        insight_diff = result.insight_diff_items[0]
        assert insight_diff.insight_type == "duplicate_files"
        assert insight_diff.status == "unresolved"
        assert insight_diff.total_savings_change == 1000

        # Check group-level diffs
        assert len(insight_diff.group_diffs) == 4
        group_diffs_by_path = {d.path: d for d in insight_diff.group_diffs}

        # banner.png - removed (with nested file diff)
        assert group_diffs_by_path["banner.png"].type.value == "removed"
        assert group_diffs_by_path["banner.png"].size_diff == -2000
        assert group_diffs_by_path["banner.png"].diff_items is not None
        assert len(group_diffs_by_path["banner.png"].diff_items) == 1

        # icon.png - increased (1000 -> 1500) - no file changes, so no nested diffs
        assert group_diffs_by_path["icon.png"].type.value == "increased"
        assert group_diffs_by_path["icon.png"].size_diff == 500
        assert group_diffs_by_path["icon.png"].diff_items is None

        # icon2.png - added (with nested file diff)
        assert group_diffs_by_path["icon2.png"].type.value == "added"
        assert group_diffs_by_path["icon2.png"].size_diff == 1500
        assert group_diffs_by_path["icon2.png"].diff_items is not None
        assert len(group_diffs_by_path["icon2.png"].diff_items) == 1

        # logo.png - added (with nested file diff)
        assert group_diffs_by_path["logo.png"].type.value == "added"
        assert group_diffs_by_path["logo.png"].size_diff == 2500
        assert group_diffs_by_path["logo.png"].diff_items is not None
        assert len(group_diffs_by_path["logo.png"].diff_items) == 1

    def test_compare_insights_groups_with_within_group_file_differences(self):
        """Test GroupsInsightResult with file-level differences within the same group."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Head has "icon.png" group with 3 files, base has same group with 2 files
        # This simulates finding an additional duplicate file
        head_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=3000,
                groups=[
                    FileSavingsResultGroup(
                        name="icon.png",
                        files=[
                            FileSavingsResult(file_path="/path/a/icon.png", total_savings=1000),
                            FileSavingsResult(file_path="/path/b/icon.png", total_savings=1000),
                            FileSavingsResult(file_path="/path/c/icon.png", total_savings=1000),
                        ],
                        total_savings=3000,
                    ),
                ],
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )
        base_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=2000,
                groups=[
                    FileSavingsResultGroup(
                        name="icon.png",
                        files=[
                            FileSavingsResult(file_path="/path/a/icon.png", total_savings=1000),
                            FileSavingsResult(file_path="/path/b/icon.png", total_savings=1000),
                        ],
                        total_savings=2000,
                    ),
                ],
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        assert len(result.insight_diff_items) == 1
        insight_diff = result.insight_diff_items[0]
        assert insight_diff.insight_type == "duplicate_files"
        assert insight_diff.status == "unresolved"
        assert insight_diff.total_savings_change == 1000

        # Check group-level and nested file-level diffs
        # Should have: 1 group diff (increased) with 1 nested file diff (added file)
        # Note: unchanged files are skipped in the diff
        assert len(insight_diff.group_diffs) == 1
        group_diff = insight_diff.group_diffs[0]

        # icon.png group - increased (2000 -> 3000)
        assert group_diff.path == "icon.png"
        assert group_diff.type.value == "increased"
        assert group_diff.size_diff == 1000

        # Check nested file diffs within the group
        assert group_diff.diff_items is not None
        assert len(group_diff.diff_items) == 1
        file_diff = group_diff.diff_items[0]

        # /path/c/icon.png - added file within the group
        assert file_diff.path == "/path/c/icon.png"
        assert file_diff.type.value == "added"
        assert file_diff.size_diff == 1000

    def test_compare_insights_groups_with_identical_groups(self):
        """Test GroupsInsightResult with identical groups between head and base."""
        head_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=1,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )
        base_metrics = PreprodArtifactSizeMetrics(
            preprod_artifact_id=2,
            metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
            identifier="test",
            max_install_size=1000,
            max_download_size=500,
        )

        # Both head and base have identical duplicate_files groups
        identical_groups = [
            FileSavingsResultGroup(
                name="LICENSE.txt",
                files=[
                    FileSavingsResult(
                        file_path="META-INF/androidx/annotation/annotation/LICENSE.txt",
                        total_savings=10175,
                    ),
                    FileSavingsResult(
                        file_path="META-INF/androidx/collection/collection/LICENSE.txt",
                        total_savings=10175,
                    ),
                ],
                total_savings=20350,
            ),
            FileSavingsResultGroup(
                name="version.txt",
                files=[
                    FileSavingsResult(
                        file_path="META-INF/androidx/core/core.version", total_savings=6
                    ),
                    FileSavingsResult(
                        file_path="META-INF/androidx/core/core-ktx.version", total_savings=6
                    ),
                ],
                total_savings=12,
            ),
        ]

        head_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=20362,
                groups=identical_groups,
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )
        base_insights = AndroidInsightResults(
            duplicate_files=DuplicateFilesInsightResult(
                total_savings=20362,
                groups=identical_groups,
            ),
            webp_optimization=None,
            large_images=None,
            large_videos=None,
            large_audio=None,
            hermes_debug_info=None,
            multiple_native_library_archs=None,
        )

        head_results = self._create_size_analysis_results(insights=head_insights)
        base_results = self._create_size_analysis_results(insights=base_insights)

        result = compare_size_analysis(head_metrics, head_results, base_metrics, base_results)

        # No insight diff items should be returned
        assert len(result.insight_diff_items) == 0
