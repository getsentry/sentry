from sentry import analytics


@analytics.eventclass("preprod_artifact.api.assemble")
class PreprodArtifactApiAssembleEvent(analytics.Event):
    organization_id: str
    project_id: str
    user_id: str | None = None


@analytics.eventclass("preprod_artifact.api.update")
class PreprodArtifactApiUpdateEvent(analytics.Event):
    organization_id: str
    project_id: str


@analytics.eventclass("preprod_artifact.api.assemble_generic")
class PreprodArtifactApiAssembleGenericEvent(analytics.Event):
    organization_id: str
    project_id: str


class PreprodArtifactApiSizeAnalysisDownloadEvent(analytics.Event):
    type = "preprod_artifact.api.size_analysis_download"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("artifact_id"),
    )


class PreprodArtifactApiGetBuildDetailsEvent(analytics.Event):
    type = "preprod_artifact.api.get_build_details"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("artifact_id"),
    )


analytics.register(PreprodArtifactApiAssembleEvent)
analytics.register(PreprodArtifactApiUpdateEvent)
analytics.register(PreprodArtifactApiAssembleGenericEvent)
analytics.register(PreprodArtifactApiSizeAnalysisDownloadEvent)
analytics.register(PreprodArtifactApiGetBuildDetailsEvent)
