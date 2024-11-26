from sentry.workflow_engine.models import (
	DataSource, 
	Detector,
	DataConditionGroup, 
	Workflow, 
	DetectorState, 
	DataCondition, 
	DataSourceDetector, 
	DetectorWorkflow, 
	WorkflowDataConditionGroup
)
from sentry.snuba.models import QuerySubscription
from sentry.incidents.grouptype import MetricAlertFire

def create_aci_metric_alert_models(organization_id, snuba_query, name, project, description, user, owner, threshold_type, sensitivity, seasonality, comparison_delta):
	query_subscription = QuerySubscription.objects.get(snuba_query=snuba_query.id)
    data_source = DataSource.update_or_create(
        organization_id=organization_id,
        query_id=query_subscription.id,
        type="SNUBA_QUERY_SUBSCRIPTION", # probably actually from an enum
    )
    data_condition_group = DataConditionGroup.update_or_create(
        logic_type=DataConditionGroup.Type.ANY, # is this how that's referenced?
        organization_id=organization_id,
    )
    workflow = Workflow.objects.update_or_create(
        name=name,
        organization_id=organization_id,
        when_condition_group=data_condition_group.id,
        enabled=True,
        created_by_id=user.id, 
    )
    detector = Detector.update_or_create(
        project_id=project.id,
        enabled=True,
        created_by_id=user.id,
        name=name,
        data_sources=data_source,
        workflow_condition_group=data_condition_group.id,
        type=MetricAlertFire.slug,
        description=description,
        owner_user_id=owner.id,
        owner_team=None, # TODO use _owner_kwargs_from_actor to find out if the owner is a user or a team
        config={ # TODO create a schema
	        "threshold_type": threshold_type,
	        "sensitivity": sensitivity,
	        "seasonality": seasonality,
	        "comparison_delta": comparison_delta,
        },  
    )