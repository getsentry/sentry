from sentry.hybridcloud.rpc import RpcModel


class RpcProjectKey(RpcModel):
    id: int
    public_key: str
    cell_name: str
