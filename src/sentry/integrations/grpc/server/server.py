"""gRPC-Web server implementation for Sentry."""

from grpcWSGI.server import gRPCContext, grpcWSGI


class SentryGrpcContext(gRPCContext):
    """Extended gRPC context that carries WSGI environ for authentication."""

    def __init__(self, environ=None):
        super().__init__()
        self.environ = environ


class SentryGrpcWSGI(grpcWSGI):
    """Extended grpcWSGI that passes environ to context for authentication."""

    def _do_grpc_request(self, rpc_method, environ, start_response):
        # Import protocol here to avoid circular import
        from grpcWSGI import protocol

        request_data = self._read_request(environ)

        # Create custom context with environ
        context = SentryGrpcContext(environ=environ)

        _, _, message = protocol.unrwap_message(request_data)
        request_proto = rpc_method.request_deserializer(message)

        resp = []

        try:
            if not rpc_method.request_streaming and not rpc_method.response_streaming:
                resp = [rpc_method.unary_unary(request_proto, context)]
            elif not rpc_method.request_streaming and rpc_method.response_streaming:
                resp = rpc_method.unary_stream(request_proto, context)
            else:
                raise NotImplementedError()
        except grpcWSGI.server.RpcAbort:
            pass

        headers = [
            ("Content-Type", "application/grpc-web+proto"),
            ("Access-Control-Allow-Origin", "*"),
            ("Access-Control-Expose-Headers", "*"),
        ]

        # For unary responses we need to immediately set the status headers.
        if not rpc_method.response_streaming:
            headers.append(("grpc-status", str(context.code.value[0])))

            if context.details:
                headers.append(("grpc-message", context.details))

        start_response("200 OK", headers)

        messages = []
        for message in resp:
            messages.append(
                protocol.wrap_message(False, False, rpc_method.response_serializer(message))
            )

        # For unary we also need to append an empty trailers message.
        if not rpc_method.response_streaming:
            messages.append(protocol.wrap_message(True, False, b""))

        return messages
