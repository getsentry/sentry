from sentry.preprod.size_analysis.issues import SizeIssueOccurrenceBuilder, insight_to_occurrences


def test_build_issue():
    builder = SizeIssueOccurrenceBuilder()
    builder.issue_title = "Duplicate file"
    builder.project_id = 1234
    issue = builder.build()

    assert issue.project_id == 1234


def test_foo():
    insight = {
        "total_savings": 35953,
        "groups": [
            {
                "name": "design_bottom_sheet_slide_in.xml",
                "files": [
                    {
                        "file_path": "res/anim-v21/design_bottom_sheet_slide_in.xml",
                        "total_savings": 112,
                    },
                    {
                        "file_path": "res/anim-v21/design_bottom_sheet_slide_out.xml",
                        "total_savings": 112,
                    },
                ],
            },
        ],
    }
    occurrences = insight_to_occurrences("duplicate_files", insight)
    assert occurrences
