from sentry import analytics


class ArtifactBundleManifestExtracted(analytics.Event):
    type = "artifactbundle.manifest_extracted"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),
        analytics.Attribute("has_debug_ids"),
    )


analytics.register(ArtifactBundleManifestExtracted)
