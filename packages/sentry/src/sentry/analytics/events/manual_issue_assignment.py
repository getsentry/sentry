from sentry import analytics


class ManualIssueAssignment(analytics.Event):
    type = "manual.issue_assignment"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("assigned_by", required=False),
        analytics.Attribute("had_to_deassign", required=False),
    )


analytics.register(ManualIssueAssignment)
