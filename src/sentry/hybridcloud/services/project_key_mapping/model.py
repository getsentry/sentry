from sentry.hybridcloud.rpc import RpcModel


class RpcProjectKeyMapping(RpcModel):
    id: int
    public_key: str
    cell_name: str
