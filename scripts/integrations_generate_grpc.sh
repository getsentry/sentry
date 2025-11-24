#!/bin/bash
set -e

PROTO_DIR="src/sentry/integrations/grpc/protos"
OUTPUT_DIR="src/sentry/integrations/grpc/generated"
CLIENT_DIR="packages/sentry-scm-client"

# Create output directories
mkdir -p "${OUTPUT_DIR}"
mkdir -p "${CLIENT_DIR}/sentry_integrations_client"

# Generate Python code for server
python -m grpc_tools.protoc \
  -I"${PROTO_DIR}" \
  --python_out="${OUTPUT_DIR}" \
  --grpc_python_out="${OUTPUT_DIR}" \
  --mypy_out="${OUTPUT_DIR}" \
  --mypy_grpc_out="${OUTPUT_DIR}" \
  "${PROTO_DIR}/scm.proto"

# Generate Python code for client package
python -m grpc_tools.protoc \
  -I"${PROTO_DIR}" \
  --python_out="${CLIENT_DIR}/sentry_integrations_client" \
  --grpc_python_out="${CLIENT_DIR}/sentry_integrations_client" \
  --mypy_out="${CLIENT_DIR}/sentry_integrations_client" \
  --mypy_grpc_out="${CLIENT_DIR}/sentry_integrations_client" \
  "${PROTO_DIR}/scm.proto"

# Create __init__.py files
touch "${OUTPUT_DIR}/__init__.py"
touch "${CLIENT_DIR}/sentry_integrations_client/__init__.py"

# Fix imports in generated files to use relative imports
sed -i '' 's/^import scm_pb2/from . import scm_pb2/' "${OUTPUT_DIR}/scm_pb2_grpc.py"
sed -i '' 's/^import scm_pb2/from . import scm_pb2/' "${CLIENT_DIR}/sentry_integrations_client/scm_pb2_grpc.py"

echo "gRPC code generation complete"
