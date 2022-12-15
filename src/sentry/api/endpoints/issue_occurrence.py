from datetime import datetime

from confluent_kafka import Producer
from django.conf import settings
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.utils import json
from sentry.utils.dates import ensure_aware
from sentry.utils.kafka_config import get_kafka_producer_cluster_options


class BasicEventSerializer(serializers.Serializer):
    event_id = serializers.CharField()
    project_id = serializers.IntegerField()
    title = serializers.CharField()
    platform = serializers.CharField()
    tags = serializers.DictField()
    timestamp = serializers.DateTimeField()
    message_timestamp = serializers.DateTimeField()


class IssueOccurrenceSerializer(serializers.Serializer):
    event_id = serializers.CharField()
    fingerprint = serializers.ListField()
    issue_title = serializers.CharField()
    subtitle = serializers.CharField()
    evidence_data = serializers.DictField()
    evidence_display = serializers.ListField()
    type = serializers.IntegerField()
    detection_time = serializers.DateTimeField()


@region_silo_endpoint
class IssueOccurrenceEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)
    private = True

    def post(self, request: Request) -> Response:
        """
        Write issue occurrence and event data to a Kafka topic
        ``````````````````````````````````````````````````````
        :auth: superuser required
        :pparam: string dummy: pass 'True' to load a dummy event instead of providing one in the request
        """
        event = {}
        if request.query_params.get("dummy") == "True" or "true":
            event = {
                "event_id": "44f1419e73884cd2b45c79918f4b6dc4",
                "project_id": 1,
                "title": "This is bad",
                "platform": "python",
                "tags": {"environment": "prod"},
                "timestamp": ensure_aware(datetime.now()),
                "message_timestamp": ensure_aware(datetime.now()),
            }
        else:
            event = request.data.pop("event")

        occurrence = request.data

        event_serializer = BasicEventSerializer(data=event)
        if not event_serializer.is_valid():
            return Response(event_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        event = event_serializer.validated_data
        occurrence["event_id"] = str(event["event_id"])

        occurrence_serializer = IssueOccurrenceSerializer(data=occurrence)
        if not occurrence_serializer.is_valid():
            return Response(occurrence_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        occurrence = occurrence_serializer.validated_data
        data = {
            **occurrence,
            "event": event,
        }

        topic = settings.KAFKA_INGEST_OCCURRENCES
        cluster_name = settings.KAFKA_TOPICS[topic]["cluster"]
        cluster_options = get_kafka_producer_cluster_options(cluster_name)
        producer = Producer(cluster_options)

        producer.produce(
            topic=topic,
            key=None,
            value=json.dumps(data, default=str),
        )
        producer.flush()

        return Response(status=status.HTTP_201_CREATED)
