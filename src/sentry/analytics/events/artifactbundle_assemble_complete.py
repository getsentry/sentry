from sentry import analytics


class ArtifactBundleAssembleComplete(analytics.Event):
    type = "artifactbundle.assemble_complete"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),
        analytics.Attribute("has_debug_ids"),
    )


analytics.register(ArtifactBundleAssembleComplete)
