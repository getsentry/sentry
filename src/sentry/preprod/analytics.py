from sentry import analytics


class PreprodArtifactApiAssembleEvent(analytics.Event):
    type = "preprod_artifact.api.assemble"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("user_id", required=False),
    )


analytics.register(PreprodArtifactApiAssembleEvent)
