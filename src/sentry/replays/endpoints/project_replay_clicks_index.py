# import uuid

# from rest_framework.request import Request
# from rest_framework.response import Response

# from sentry import features
# from sentry.api.base import region_silo_endpoint
# from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
# from sentry.models.project import Project
# from sentry.replays.post_process import process_raw_response
# from sentry.replays.query import query_replay_instance

# REFERRER = "replays.query.query_replays_clicks_dataset"


# class ReplayDetailsPermission(ProjectPermission):
#     scope_map = {
#         "GET": ["project:read", "project:write", "project:admin"],
#         "POST": ["project:write", "project:admin"],
#         "PUT": ["project:write", "project:admin"],
#         "DELETE": ["project:read", "project:write", "project:admin"],
#     }


# @region_silo_endpoint
# class ProjectReplayClicksIndexEndpoint(ProjectEndpoint):

#     permission_classes = (ReplayDetailsPermission,)

#     def get(self, request: Request, project: Project, replay_id: str) -> Response:
#         if not features.has(
#             "organizations:session-replay", project.organization, actor=request.user
#         ):
#             return Response(status=404)

#         filter_params = self.get_filter_params(request, project)

#         try:
#             replay_id = str(uuid.UUID(replay_id))
#         except ValueError:
#             return Response(status=404)

#         snuba_response = query_replay_instance(
#             project_id=project.id,
#             replay_id=replay_id,
#             start=filter_params["start"],
#             end=filter_params["end"],
#             tenant_ids={"organization_id": project.organization_id},
#         )

#         response = process_raw_response(
#             snuba_response,
#             fields=request.query_params.getlist("field"),
#         )

#         if len(response) == 0:
#             return Response(status=404)
#         else:
#             return Response({"data": response[0]}, status=200)


# def query(
#     project_id: int,
#     replay_id: str,
#     start: datetime.datetime,
#     end: datetime.datetime,
# ):
#     snuba_request = Request(
#         dataset="replays",
#         app_id="replay-backend-web",
#         query=Query(
#             match=Entity("replays"),
#             select=[
#                 Column("click_node_id"),
#                 Column("click_timestamp"),
#             ],
#             where=[
#                 Condition(Column("project_id"), Op.EQ, project_id),
#                 Condition(Column("replay_id"), Op.EQ, replay_id),
#                 Condition(Column("timestamp"), Op.LT, datetime.now()),
#                 Condition(Column("timestamp"), Op.GTE, start),
#             ],
#             having=[],
#             orderby=[OrderBy(Column("click_timestamp"), Direction.DESC)],
#             limit=Limit(limit),
#             offset=Offset(offset),
#             granularity=Granularity(3600),
#         ),
#         tenant_ids=tenant_ids,
#     )
#     return raw_snql_query(snuba_request, REFERRER)
