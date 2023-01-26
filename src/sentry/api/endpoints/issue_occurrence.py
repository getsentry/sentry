from datetime import datetime

from confluent_kafka import Producer
from django.conf import settings
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.models.project import Project
from sentry.services.hybrid_cloud.user import user_service
from sentry.types.issues import GroupType
from sentry.utils import json
from sentry.utils.dates import ensure_aware
from sentry.utils.kafka_config import get_kafka_producer_cluster_options


class BasicEventSerializer(serializers.Serializer):
    event_id = serializers.CharField()
    project_id = serializers.IntegerField()
    platform = serializers.CharField()
    tags = serializers.DictField()
    timestamp = serializers.DateTimeField()
    received = serializers.DateTimeField()


class IssueOccurrenceSerializer(serializers.Serializer):
    id = serializers.CharField()
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
        :pparam: string dummyEvent: pass 'True' to load a dummy event instead of providing one in the request
        :pparam: string dummyOccurrence: pass 'True' to load a dummy occurrence instead of providing one in the request
        """
        event = {}
        if request.query_params.get("dummyEvent") == "True":
            user = user_service.get_user(request.user.id)
            projects = Project.objects.get_for_user_ids({user.id})
            if not projects:
                return Response(
                    "Requesting user must belong to at least one project.",
                    status=status.HTTP_400_BAD_REQUEST,
                )
            event = {
                "event_id": "44f1419e73884cd2b45c79918f4b6dc4",
                "project_id": projects[0].id,
                "platform": "python",
                "stack_trace": {
                    "frames": [
                        {"function": "0x0", "in_app": False},
                        {"function": "0x0", "in_app": False},
                        {"function": "start_sim", "in_app": False},
                        {"function": "main", "in_app": False, "package": "xctest"},
                        {"function": "_XCTestMain", "in_app": False, "package": "XCTestCore"},
                        {
                            "function": "-[XCTestDriver _runTests]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestObservationCenter _observeTestExecutionForBlock:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__25-[XCTestDriver _runTests]_block_invoke.184",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTExecutionWorker runWithError:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__72-[XCTExecutionWorker enqueueTestIdentifiersToRun:testIdentifiersToSkip:]_block_invoke_2",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTTestRunSession executeTestsWithIdentifiers:skippingTestsWithIdentifiers:completion:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext runInContextForTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext _runInChildOfContext:forTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__89-[XCTTestRunSession executeTestsWithIdentifiers:skippingTestsWithIdentifiers:completion:]_block_invoke",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {"function": "-[XCTest runTest]", "in_app": False, "package": "XCTestCore"},
                        {
                            "function": "-[XCTestSuite performTest:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestSuite _performProtectedSectionForTest:testSection:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext runInContextForTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext _runInChildOfContext:forTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__59-[XCTestSuite _performProtectedSectionForTest:testSection:]_block_invoke",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__27-[XCTestSuite performTest:]_block_invoke",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestSuite runTestBasedOnRepetitionPolicy:testRun:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {"function": "-[XCTest runTest]", "in_app": False, "package": "XCTestCore"},
                        {
                            "function": "-[XCTestSuite performTest:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestSuite _performProtectedSectionForTest:testSection:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext runInContextForTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext _runInChildOfContext:forTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__59-[XCTestSuite _performProtectedSectionForTest:testSection:]_block_invoke",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__27-[XCTestSuite performTest:]_block_invoke",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestSuite runTestBasedOnRepetitionPolicy:testRun:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {"function": "-[XCTest runTest]", "in_app": False, "package": "XCTestCore"},
                        {
                            "function": "-[XCTestSuite performTest:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestSuite _performProtectedSectionForTest:testSection:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext runInContextForTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext _runInChildOfContext:forTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__59-[XCTestSuite _performProtectedSectionForTest:testSection:]_block_invoke",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__27-[XCTestSuite performTest:]_block_invoke",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestSuite runTestBasedOnRepetitionPolicy:testRun:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {"function": "-[XCTest runTest]", "in_app": False, "package": "XCTestCore"},
                        {
                            "function": "-[XCTestCase performTest:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext runInContextForTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTContext _runInChildOfContext:forTestCase:markAsReportingBase:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__26-[XCTestCase performTest:]_block_invoke.110",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestCase(XCTIssueHandling) _caughtUnhandledDeveloperExceptionPermittingControlFlowInterruptions:caughtInterruptionException:whileExecutingBlock:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__26-[XCTestCase performTest:]_block_invoke.119",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestCase invokeTest]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[XCTestCase(XCTIssueHandling) _caughtUnhandledDeveloperExceptionPermittingControlFlowInterruptions:caughtInterruptionException:whileExecutingBlock:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__24-[XCTestCase invokeTest]_block_invoke.78",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTFailableInvocation invokeInvocation:lastObservedErrorIssue:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTFailableInvocation invokeInvocation:withTestMethodConvention:lastObservedErrorIssue:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTFailableInvocation invokeWithAsynchronousWait:lastObservedErrorIssue:block:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTSwiftErrorObservation observeErrorsInBlock:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__81+[XCTFailableInvocation invokeWithAsynchronousWait:lastObservedErrorIssue:block:]_block_invoke.5",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "__90+[XCTFailableInvocation invokeInvocation:withTestMethodConvention:lastObservedErrorIssue:]_block_invoke_3",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "+[XCTFailableInvocation invokeStandardConventionInvocation:completion:]",
                            "in_app": False,
                            "package": "XCTestCore",
                        },
                        {
                            "function": "-[NSInvocation invoke]",
                            "in_app": False,
                            "package": "CoreFoundation",
                        },
                        {"function": "__invoking___", "in_app": False, "package": "CoreFoundation"},
                        {
                            "function": "@objc SentryProfilerSwiftTests.testMetricProfiler()",
                            "in_app": False,
                            "package": "SentryTests",
                        },
                        {
                            "function": "SentryProfilerSwiftTests.testMetricProfiler()",
                            "in_app": False,
                            "package": "SentryTests",
                        },
                        {
                            "function": "SentryProfilerSwiftTests.forceProfilerSample()",
                            "in_app": False,
                            "package": "SentryTests",
                        },
                        {
                            "function": "StringProtocol.appending<A>(A1)",
                            "in_app": False,
                            "package": "Foundation",
                        },
                        {
                            "function": "-[NSString stringByAppendingString:]",
                            "in_app": False,
                            "package": "Foundation",
                        },
                        {
                            "function": "_NSNewStringByAppendingStrings",
                            "in_app": False,
                            "package": "Foundation",
                        },
                        {
                            "function": "-[__NSCFString getCharacters:range:]",
                            "in_app": False,
                            "package": "CoreFoundation",
                        },
                    ]
                },
                "tags": {"environment": "prod"},
                "timestamp": ensure_aware(datetime.now()),
                "received": ensure_aware(datetime.now()),
            }
        else:
            event = request.data.pop("event", None)

        if not event:
            return Response(
                "Must pass an event or query param of dummyEvent=True",
                status=status.HTTP_400_BAD_REQUEST,
            )

        occurrence = {}
        if request.query_params.get("dummyOccurrence") == "True":
            occurrence = {
                "id": "55f1419e73884cd2b45c79918f4b6dc5",
                "fingerprint": ["some-fingerprint"],
                "issue_title": "something bad happened",
                "subtitle": "it was bad",
                "resource_id": "1234",
                "evidence_data": {"Test": 123},
                "evidence_display": [
                    {
                        "name": "Attention",
                        "value": "Very important information!!!",
                        "important": True,
                    },
                    {
                        "name": "Evidence 2",
                        "value": "Not important",
                        "important": False,
                    },
                    {
                        "name": "Evidence 3",
                        "value": "Nobody cares about this",
                        "important": False,
                    },
                ],
                "type": GroupType.PROFILE_BLOCKED_THREAD.value,
                "detection_time": ensure_aware(datetime.now()),
                "event": event,
            }
        else:
            occurrence = request.data

        if not occurrence:
            return Response(
                "Must pass occurrence data or query param of dummyOccurrence=True",
                status=status.HTTP_400_BAD_REQUEST,
            )

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
