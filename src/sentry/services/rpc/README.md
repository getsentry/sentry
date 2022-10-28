# RPC Prototype

To generate files from `*.proto` files. Run the following from **`<ROOT_DIR>/src`**:

```shell
python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. src/sentry/services/rpc/protobufs/*.proto
```
