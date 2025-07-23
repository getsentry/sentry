from sentry import analytics


class SuspectCommitAssignment(analytics.Event):
    type = "suspectcommit.assignment"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("updated_assignment"),
    )


analytics.register(SuspectCommitAssignment)
