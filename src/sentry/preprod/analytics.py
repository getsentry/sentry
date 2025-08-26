from sentry import analytics


@analytics.eventclass("preprod_artifact.api.assemble")
class PreprodArtifactApiAssembleEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None


@analytics.eventclass("preprod_artifact.api.update")
class PreprodArtifactApiUpdateEvent(analytics.Event):
    organization_id: int
    project_id: int


@analytics.eventclass("preprod_artifact.api.assemble_generic")
class PreprodArtifactApiAssembleGenericEvent(analytics.Event):
    organization_id: int
    project_id: int


@analytics.eventclass("preprod_artifact.api.size_analysis_download")
class PreprodArtifactApiSizeAnalysisDownloadEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.get_build_details")
class PreprodArtifactApiGetBuildDetailsEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.list_builds")
class PreprodArtifactApiListBuildsEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None


@analytics.eventclass("preprod_artifact.api.admin_rerun_analysis")
class PreprodArtifactApiRerunAnalysisEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.admin_get_info")
class PreprodArtifactApiAdminGetInfoEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.admin_batch_delete")
class PreprodArtifactApiAdminBatchDeleteEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_count: int


class PreprodArtifactApiInstallDetailsEvent(analytics.Event):
    type = "preprod_artifact.api.install_details"

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
analytics.register(PreprodArtifactApiListBuildsEvent)
analytics.register(PreprodArtifactApiInstallDetailsEvent)
analytics.register(PreprodArtifactApiRerunAnalysisEvent)
analytics.register(PreprodArtifactApiAdminGetInfoEvent)
analytics.register(PreprodArtifactApiAdminBatchDeleteEvent)
