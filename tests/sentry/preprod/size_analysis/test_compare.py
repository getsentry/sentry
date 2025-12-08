from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.compare import (
    _should_skip_diff_item_comparison,
    compare_size_analysis,
)
from sentry.preprod.size_analysis.models import (
    ComparisonResults,
    DiffType,
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

    def _create_treemap_element(self, name, size, path=None, children=None):
        """Helper to create TreemapElement."""
        return TreemapElement(
            name=name,
            size=size,
            path=path,
            is_dir=children is not None,
            children=children or [],
        )

    def _create_size_analysis_results(
        self, download_size=500, install_size=1000, treemap_root=None
    ):
        """Helper to create SizeAnalysisResults."""
        treemap = None
        if treemap_root:
            treemap = TreemapResults(
                root=treemap_root,
                file_count=1,  # Required field
                category_breakdown={},
                platform="test",
            )

        return SizeAnalysisResults(
            analysis_duration=1.0,
            download_size=download_size,
            install_size=install_size,
            treemap=treemap,
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


class CompareWithVersionSkippingTest(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)

    def _create_treemap_element(self, name, size, path=None, children=None):
        """Helper to create TreemapElement."""
        return TreemapElement(
            name=name,
            size=size,
            path=path,
            is_dir=children is not None,
            children=children or [],
        )

    def _create_size_analysis_results(
        self, download_size=500, install_size=1000, treemap_root=None, analysis_version=None
    ):
        """Helper to create SizeAnalysisResults."""
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
            analysis_version=analysis_version,
        )

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
