from __future__ import annotations

import logging

from django.db.models import F
from django.http.response import FileResponse, HttpResponse, HttpResponseBase
from django.utils import timezone
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.models.files.file import File
from sentry.models.project import Project
from sentry.preprod.eap.write import produce_preprod_build_distribution_to_eap
from sentry.preprod.models import InstallablePreprodArtifact, PreprodArtifact
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


@region_silo_endpoint
class ProjectInstallablePreprodArtifactDownloadEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    authentication_classes = ()  # No authentication required
    permission_classes = ()

    def get(self, request: Request, project: Project, url_path: str) -> HttpResponseBase:
        """
        Download an installable preprod artifact or its plist, if not expired.
        """
        format_type = request.GET.get("response_format")
        try:
            installable = InstallablePreprodArtifact.objects.select_related(
                "preprod_artifact",
                "preprod_artifact__project",
            ).get(
                url_path=url_path,
            )
        except InstallablePreprodArtifact.DoesNotExist:
            return Response({"error": "Installable preprod artifact not found"}, status=404)

        # Validate that the URL parameters match the actual organization and project
        preprod_artifact: PreprodArtifact = installable.preprod_artifact

        if preprod_artifact.project.id != project.id:
            return Response({"error": "Project not found"}, status=404)

        if installable.expiration_date and timezone.now() > installable.expiration_date:
            return Response({"error": "Install link expired"}, status=410)

        preprod_artifact = installable.preprod_artifact
        if preprod_artifact.installable_app_file_id is None:
            return Response({"error": "No installable file available"}, status=404)

        try:
            file_obj = File.objects.get(id=preprod_artifact.installable_app_file_id)
        except File.DoesNotExist:
            return Response({"error": "Installable file not found"}, status=404)

        if format_type == "plist":
            app_id = preprod_artifact.app_id
            build_version = preprod_artifact.build_version
            app_name = preprod_artifact.app_name
            if not app_id or not build_version or not app_name:
                return Response({"error": "App details not found"}, status=404)

            ipa_url = absolute_uri(
                f"/api/0/projects/{project.organization.slug}/{project.slug}/files/installablepreprodartifact/{installable.url_path}/?response_format=ipa"
            )
            plist = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>items</key>
  <array>
    <dict>
      <key>assets</key>
      <array>
        <dict>
          <key>kind</key>
          <string>software-package</string>
          <key>url</key>
          <string>{ipa_url}</string>
        </dict>
      </array>
      <key>metadata</key>
      <dict>
        <key>bundle-identifier</key>
        <string>{app_id}</string>
        <key>bundle-version</key>
        <string>{build_version}</string>
        <key>kind</key>
        <string>software</string>
        <key>platform-identifier</key>
        <string>com.apple.platform.iphoneos</string>
        <key>title</key>
        <string>{app_name}</string>
      </dict>
    </dict>
  </array>
</dict>
</plist>"""
            return HttpResponse(plist, content_type="text/plain; charset=utf-8")
        else:
            InstallablePreprodArtifact.objects.filter(pk=installable.pk).update(
                download_count=F("download_count") + 1
            )

            # Update build distribution data in EAP with new download count
            try:
                organization = project.organization
                if features.has("organizations:preprod-build-distribution-eap-write", organization):
                    produce_preprod_build_distribution_to_eap(
                        artifact=preprod_artifact,
                        organization_id=project.organization_id,
                        project_id=project.id,
                    )
            except Exception:
                logger.exception(
                    "Failed to write preprod build distribution to EAP after download",
                    extra={
                        "preprod_artifact_id": preprod_artifact.id,
                        "organization_id": project.organization_id,
                        "project_id": project.id,
                    },
                )

            fp = file_obj.getfile()
            filename = preprod_artifact.app_id or "app"
            if preprod_artifact.build_version:
                filename += f"@{preprod_artifact.build_version}"
            if preprod_artifact.build_number:
                filename += f"+{preprod_artifact.build_number}"
            ext = format_type if format_type else "bin"
            filename += f".{ext}"
            response = FileResponse(
                fp,
                content_type="application/octet-stream",
            )
            response["Content-Length"] = file_obj.size
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response
