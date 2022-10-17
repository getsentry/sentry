from rest_framework.request import Request
from rest_framework.response import Response

from sentry import eventstore
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.rule import RuleEndpoint
from sentry.rules.processor import RuleProcessor
from sentry.utils.safe import safe_execute
from sentry.web.decorators import transaction_start


@region_silo_endpoint
class ProjectRuleActionsEndpoint(RuleEndpoint):
    private = True

    @transaction_start("ProjectRuleActionsEndpoint")
    def post(self, request: Request, project, rule) -> Response:
        """
        Activate a rule's downstream actions using the data from a previous event
        """
        events = eventstore.get_events(eventstore.Filter(project_ids=[project.id]), limit=1)
        # TODO: use dummy event if there are no events in the project
        if not events:
            return Response(
                "There are no events under this project that can be used to test", status=400
            )
        test_event = events[0]
        # TODO: edit the event in a way to show that this is a test and not real

        rp = RuleProcessor(test_event, False, False, False, False)
        rp.activate_downstream_actions(rule)

        for callback, futures in rp.grouped_futures.values():
            safe_execute(callback, test_event, futures, _with_transaction=False)

        return Response()
