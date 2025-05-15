import sentry_sdk_alpha
from sentry_sdk_alpha.consts import OP
from sentry_sdk_alpha.integrations import DidNotEnable
from sentry_sdk_alpha.integrations.grpc.consts import SPAN_ORIGIN
from sentry_sdk_alpha.tracing import TransactionSource

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing import Callable, Optional
    from google.protobuf.message import Message

try:
    import grpc
    from grpc import ServicerContext, HandlerCallDetails, RpcMethodHandler
except ImportError:
    raise DidNotEnable("grpcio is not installed")


class ServerInterceptor(grpc.ServerInterceptor):  # type: ignore
    def __init__(self, find_name=None):
        # type: (ServerInterceptor, Optional[Callable[[ServicerContext], str]]) -> None
        self._find_method_name = find_name or ServerInterceptor._find_name

        super().__init__()

    def intercept_service(self, continuation, handler_call_details):
        # type: (ServerInterceptor, Callable[[HandlerCallDetails], RpcMethodHandler], HandlerCallDetails) -> RpcMethodHandler
        handler = continuation(handler_call_details)
        if not handler or not handler.unary_unary:
            return handler

        def behavior(request, context):
            # type: (Message, ServicerContext) -> Message
            with sentry_sdk_alpha.isolation_scope():
                name = self._find_method_name(context)

                if name:
                    metadata = dict(context.invocation_metadata())

                    with sentry_sdk_alpha.continue_trace(metadata):
                        with sentry_sdk_alpha.start_span(
                            op=OP.GRPC_SERVER,
                            name=name,
                            source=TransactionSource.CUSTOM,
                            origin=SPAN_ORIGIN,
                        ):
                            try:
                                return handler.unary_unary(request, context)
                            except BaseException as e:
                                raise e
                else:
                    return handler.unary_unary(request, context)

        return grpc.unary_unary_rpc_method_handler(
            behavior,
            request_deserializer=handler.request_deserializer,
            response_serializer=handler.response_serializer,
        )

    @staticmethod
    def _find_name(context):
        # type: (ServicerContext) -> str
        return context._rpc_event.call_details.method.decode()
