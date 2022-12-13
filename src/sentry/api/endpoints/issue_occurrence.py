from django.conf import settings
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint
from sentry.api.permissions import SuperuserPermission

# from sentry.api.serializers import SimpleEventSerializer, serialize
from sentry.eventstream.kafka import KafkaEventStream
from sentry.utils import json


class IssueOccurrenceSerializer(serializers.Serializer):
    # id = serializers.IntegerField()
    event_id = serializers.CharField()
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

        # this needs to be passed an Event or GroupEvent instance which obviously doesn't work here
        # but not sure what to use instead. maybe can skip this since it's a temp internal thing?

        # event_serializer = serialize(event, request.user, SimpleEventSerializer())
        # if not event_serializer.is_valid():
        #     return Response(event_serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        # event = event_serializer.validated_data

        occurrence["event_id"] = str(event["event_id"])

        serializer = IssueOccurrenceSerializer(data=occurrence)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        occurrence = serializer.validated_data

        eventstream = KafkaEventStream()
        topic = settings.KAFKA_EVENTS  # needs to be changed, not sure what the new topic is called
        producer = eventstream.get_producer(topic)
        data = {
            **occurrence,
            "event": event,
        }

        producer.produce(
            topic=topic,
            key=None,
            value=json.dumps(data, default=str),
        )
        producer.flush()

        return Response(status=status.HTTP_201_CREATED)
        # Do we want to return data in the response
