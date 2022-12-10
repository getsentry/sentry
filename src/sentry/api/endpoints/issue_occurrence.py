from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.api.serializers import EventSerializer, serialize


class IssueOccurrenceSerializer(serializers.Serializer):
    # id = serializers.IntegerField()
    event_id = serializers.UUIDField()
    fingerprint = serializers.ListField()
    issue_title = serializers.CharField()
    subtitle = serializers.CharField()
    evidence_data = serializers.DictField()
    evidence_display = serializers.ListField()
    type = serializers.IntegerField()
    detection_time = serializers.DateTimeField()


class IssueOccurrenceEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)
    private: True

    def post(self, request: Request) -> Response:
        """
        Write Issue occurrence data to a Kafka topic
        `````````````````````````````````
        :auth: required
        """
        event = request.data.pop("event")
        occurrence = request.data

        # having issues here, clearly not sending the right format
        # going to asssume for now it's valid data. or maybe passing an event_id makes more sense idk

        # event_serializer = serialize(event, request.user, EventSerializer())
        # if not event_serializer.is_valid():
        #     return Response(event_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        # event = event_serializer.validated_data

        occurrence["event_id"] = event["id"]

        serializer = IssueOccurrenceSerializer(data=occurrence)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        occurrence = serializer.validated_data

        print("occurrence: ", occurrence)

        # write to kafka topic - see eventstream/kafka/backend.py#L171-L202
        # example dan code below
        # producer.produce(
        #     topic=topic,
        #     key=None,
        #     value=json.dumps(<your_data>),
        # )
        # producer.flush()

        return Response(status=201)
