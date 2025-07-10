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


analytics.register(PreprodArtifactApiAssembleEvent)
analytics.register(PreprodArtifactApiUpdateEvent)
analytics.register(PreprodArtifactApiAssembleGenericEvent)
