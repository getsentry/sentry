from sentry import analytics


class ArtifactBundleAssemble(analytics.Event):
    type = "artifactbundle.assemble"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),
        analytics.Attribute("user_agent", required=False),
        analytics.Attribute("auth_type", required=False),
    )


analytics.register(ArtifactBundleAssemble)
