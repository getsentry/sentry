from __future__ import annotations

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


@analytics.eventclass("preprod_artifact.api.get_build_details")
class PreprodArtifactApiGetBuildDetailsEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.list_builds")
class PreprodArtifactApiListBuildsEvent(analytics.Event):
    organization_id: int
    user_id: int | None = None


@analytics.eventclass("preprod_artifact.api.install_details")
class PreprodArtifactApiInstallDetailsEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.admin_rerun_analysis")
class PreprodArtifactApiRerunAnalysisEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.rerun_status_checks")
class PreprodArtifactApiRerunStatusChecksEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str
    check_types: list[str]


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


@analytics.eventclass("preprod_artifact.api.delete")
class PreprodArtifactApiDeleteEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


# Size analysis
@analytics.eventclass("preprod_artifact.api.size_analysis_download")
class PreprodArtifactApiSizeAnalysisDownloadEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.size_analysis_compare.get")
class PreprodArtifactApiSizeAnalysisCompareGetEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    head_artifact_id: str
    base_artifact_id: str


@analytics.eventclass("preprod_artifact.api.size_analysis_compare.post")
class PreprodArtifactApiSizeAnalysisComparePostEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    head_artifact_id: str
    base_artifact_id: str


@analytics.eventclass("preprod_artifact.api.size_analysis_compare_download")
class PreprodArtifactApiSizeAnalysisCompareDownloadEvent(analytics.Event):
    organization_id: int
    project_id: int
    user_id: int | None = None
    head_size_metric_id: str
    base_size_metric_id: str


# PR page
@analytics.eventclass("preprod_artifact.api.pr_page.details")
class PreprodApiPrPageDetailsEvent(analytics.Event):
    organization_id: int
    user_id: int | None = None
    repo_name: str
    pr_number: str


@analytics.eventclass("preprod_artifact.api.pr_page.size_analysis_download")
class PreprodApiPrPageSizeAnalysisDownloadEvent(analytics.Event):
    organization_id: int
    user_id: int | None = None
    artifact_id: str


@analytics.eventclass("preprod_artifact.api.pr_page.comments")
class PreprodApiPrPageCommentsEvent(analytics.Event):
    organization_id: int
    user_id: int | None = None
    repo_name: str
    pr_number: str


analytics.register(PreprodArtifactApiAssembleEvent)
analytics.register(PreprodArtifactApiUpdateEvent)
analytics.register(PreprodArtifactApiAssembleGenericEvent)
analytics.register(PreprodArtifactApiGetBuildDetailsEvent)
analytics.register(PreprodArtifactApiListBuildsEvent)
analytics.register(PreprodArtifactApiInstallDetailsEvent)
analytics.register(PreprodArtifactApiRerunAnalysisEvent)
analytics.register(PreprodArtifactApiRerunStatusChecksEvent)
analytics.register(PreprodArtifactApiAdminGetInfoEvent)
analytics.register(PreprodArtifactApiAdminBatchDeleteEvent)
analytics.register(PreprodArtifactApiDeleteEvent)
# Size analysis
analytics.register(PreprodArtifactApiSizeAnalysisDownloadEvent)
analytics.register(PreprodArtifactApiSizeAnalysisCompareGetEvent)
analytics.register(PreprodArtifactApiSizeAnalysisComparePostEvent)
analytics.register(PreprodArtifactApiSizeAnalysisCompareDownloadEvent)
# PR page
analytics.register(PreprodApiPrPageDetailsEvent)
analytics.register(PreprodApiPrPageSizeAnalysisDownloadEvent)
analytics.register(PreprodApiPrPageCommentsEvent)
