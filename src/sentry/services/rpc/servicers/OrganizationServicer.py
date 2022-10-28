from sentry.services.rpc.protobufs import Organization_pb2, Organization_pb2_grpc


class OrganizationServicer(Organization_pb2_grpc.OrganizationServiceServicer):
    def ChangeName(self, request, context):
        print("Received the following organization req:")
        print(request.item_id)
        response = Organization_pb2.Organization(id=1, name="testing")

        print("Responding with:")
        print(response)
        return response
