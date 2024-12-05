from sentry.incidents.grouptype import MetricAlertFire
from sentry.snuba.models import QuerySubscription
from sentry.workflow_engine.models import (  # DataSourceDetector,; DetectorWorkflow,; WorkflowDataConditionGroup,
    DataConditionGroup,
    DataSource,
    Detector,
    DetectorState,
    Workflow,
)
from sentry.workflow_engine.types import DetectorPriorityLevel


def populate_alert_lookup_tables():
    # maybe do lookups in a separate function?
    # AlertRuleDetector lookup table
    # AlertRuleWorkflow lookup table
    # DataConditionGroupAction lookup
    # DataSourceDetector lookup
    # DetectorWorkflow lookup
    # WorkflowDataConditionGroup lookup
    pass


def create_detector_and_workflow(
    organization_id: int,
    snuba_query,
    name: str,
    project,
    description: str,
    user,
    owner,
    threshold_type,
    sensitivity,
    seasonality,
    comparison_delta,
):
    query_subscription = QuerySubscription.objects.get(snuba_query=snuba_query.id)
    data_source = DataSource.objects.create(
        organization_id=organization_id,
        query_id=query_subscription.id,
        type="SNUBA_QUERY_SUBSCRIPTION",  # probably actually from an enum
    )  # might create this separately

    data_condition_group = DataConditionGroup.objects.create(
        logic_type=DataConditionGroup.Type.ANY,  # is this how that's referenced?
        organization_id=organization_id,
    )
    Workflow.objects.create(
        name=name,
        organization_id=organization_id,
        when_condition_group=data_condition_group.id,
        enabled=True,
        created_by_id=user.id,  # user is optional
    )
    detector = Detector.objects.create(
        project_id=project.id,
        enabled=True,
        created_by_id=user.id,
        name=name,
        data_sources=data_source,
        workflow_condition_group=data_condition_group.id,
        type=MetricAlertFire.slug,
        description=description,
        owner_user_id=owner.id,
        owner_team=None,  # TODO use _owner_kwargs_from_actor to find out if the owner is a user or a team
        config={  # TODO create a schema
            "threshold_type": threshold_type,
            "sensitivity": sensitivity,
            "seasonality": seasonality,
            "comparison_delta": comparison_delta,
        },
    )
    DetectorState.objects.create(
        detector=detector.id,
        active=False,
        state=DetectorPriorityLevel.OK,
    )
    # Action (to add with trigger creation)
    # DataCondition (to add with trigger creation)
