from sentry.services.hybrid_cloud import RpcModel


class RpcGroupShareMetadata(RpcModel):
    title: str
    message: str
