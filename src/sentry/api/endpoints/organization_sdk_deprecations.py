from collections import defaultdict
from typing import DefaultDict, TypedDict

import sentry_sdk
from packaging.version import InvalidVersion
from packaging.version import parse as parse_version
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.models.project import Project
from sentry.models.projectsdk import EventType, ProjectSDK, get_minimum_sdk_version


class SDKDeprecationsSerializer(serializers.Serializer):
    event_type = serializers.ChoiceField(
        choices=("profile",),
        required=True,
    )


class SDKDeprecation(TypedDict):
    projectId: str
    minimumVersion: str
    sdkName: str
    sdkVersion: str


class SDKDeprecationsResult(TypedDict):
    data: list[SDKDeprecation]


@region_silo_endpoint
class OrganizationSdkDeprecationsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.PROFILING

    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    def get(self, request: Request, organization) -> Response:
        serializer = SDKDeprecationsSerializer(data=request.GET)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        projects = self.get_projects(request, organization)

        event_types = get_event_types(serializer.data["event_type"])

        project_sdks = ProjectSDK.objects.filter(
            project__in=projects,
            event_type__in=[event_type.value for event_type in event_types],
        )

        sdk_deprecations_by_project: DefaultDict[Project, list[SDKDeprecation]] = defaultdict(list)
        projects_with_up_to_date_sdk: set[Project] = set()

        for project_sdk in project_sdks:
            deprecation = get_deprecation_status(project_sdk)
            if deprecation is None:
                projects_with_up_to_date_sdk.add(project_sdk.project)
            else:
                sdk_deprecations_by_project[project_sdk.project].append(deprecation)

        deprecations: list[SDKDeprecation] = []

        for project, sdk_deprecations in sdk_deprecations_by_project.items():
            if project in projects_with_up_to_date_sdk:
                # It's possible that a single project contains data from different SDKs.
                # Here we just want 1 up to date SDK sending data to this project.
                #
                # If we require all SDKs sending data to this project to be up to date,
                # we risk checking against SDKs that may no longer be sending data.
                # We would have to track a last seen timestamp to be more sure which
                # is an expensive operation that we're not doing right now.
                continue

            deprecations.extend(sdk_deprecations)

        result: SDKDeprecationsResult = {"data": deprecations}

        return Response(result, status=200)


def get_event_types(raw_event_type: str) -> list[EventType]:
    if raw_event_type == "profile":
        return [EventType.PROFILE_CHUNK]
    raise ValueError(f"Unknown event type: {raw_event_type}")


def get_deprecation_status(project_sdk: ProjectSDK) -> SDKDeprecation | None:
    try:
        sdk_version = parse_version(project_sdk.sdk_version)
    except InvalidVersion as e:
        sentry_sdk.capture_exception(e)
        return None

    minimum_sdk_version = get_minimum_sdk_version(
        project_sdk.event_type,
        project_sdk.sdk_name,
        hard_limit=False,
    )

    # no minimum sdk version was specified
    if minimum_sdk_version is None:
        return None

    # satisfies the minimum sdk version
    if sdk_version >= minimum_sdk_version:
        return None

    return {
        "projectId": str(project_sdk.project_id),
        "minimumVersion": str(minimum_sdk_version),
        "sdkName": project_sdk.sdk_name,
        "sdkVersion": str(sdk_version),
    }
