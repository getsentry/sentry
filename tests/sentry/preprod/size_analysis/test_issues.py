from sentry.issues.grouptype import PreprodDeltaGroupType
from sentry.preprod.models import PreprodArtifactSizeMetrics
from sentry.preprod.size_analysis.issues import diff_to_occurrence
from sentry.preprod.size_analysis.models import SizeMetricDiffItem


def test_diff_to_occurrence_install():

    diff = SizeMetricDiffItem(
        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        identifier=None,
        base_install_size=100,
        head_install_size=150,
        base_download_size=300,
        head_download_size=400,
    )

    occurrence, event = diff_to_occurrence(42, "install", diff)

    assert occurrence.project_id == 42
    assert occurrence.issue_title == "50 byte install size regression"
    assert occurrence.type == PreprodDeltaGroupType

    # Event has some required feilds which should match issue:
    assert occurrence.event_id == event["event_id"]
    assert occurrence.project_id == event["project_id"]
    # event has timestamp as string, occurrence as object
    assert occurrence.detection_time.timestamp() == event["timestamp"]

    # Event has some required fields which need to be set correctly:
    assert event["platform"] == "other"


def test_diff_to_occurrence_download():

    diff = SizeMetricDiffItem(
        metrics_artifact_type=PreprodArtifactSizeMetrics.MetricsArtifactType.MAIN_ARTIFACT,
        identifier=None,
        base_install_size=100,
        head_install_size=150,
        base_download_size=300,
        head_download_size=500,
    )

    occurrence, event = diff_to_occurrence(43, "download", diff)

    assert occurrence.project_id == 43
    assert occurrence.issue_title == "200 byte download size regression"
    assert occurrence.type == PreprodDeltaGroupType

    # Event has some required feilds which should match the occurrence:
    assert occurrence.event_id == event["event_id"]
    assert occurrence.project_id == event["project_id"]
    # event has timestamp as string, occurrence as object
    assert occurrence.detection_time.timestamp() == event["timestamp"]

    # Event has some required fields which need to be set correctly:
    assert event["platform"] == "other"
