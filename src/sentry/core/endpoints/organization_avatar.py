import io
import logging
from typing import Any

from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework import serializers

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models.avatars.organization_avatar import OrganizationAvatar
from sentry.users.services.avatar_generation import AvatarGenerationError, avatar_generation_service

logger = logging.getLogger(__name__)


@region_silo_endpoint
class OrganizationAvatarEndpoint(AvatarMixin[OrganizationAvatar], OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    object_type = "organization"
    model = OrganizationAvatar

    def get_avatar_filename(self, obj):
        # for consistency with organization details endpoint
        return f"{obj.slug}.png"

    def save_avatar(
        self, obj: Any, serializer: serializers.Serializer, **kwargs: Any
    ) -> tuple[OrganizationAvatar, str | None]:
        """Override save_avatar to handle AI generation for organizations."""
        result = serializer.validated_data
        avatar_type = result["avatar_type"]

        if avatar_type == "ai_generated":
            prompt = result.get("ai_prompt", "")
            avatar_photo = result.get("avatar_photo")

            if avatar_photo and prompt == "cropped_ai_avatar":
                try:
                    existing_avatar = self.model.objects.get(organization=obj)
                    existing_avatar.delete()
                except self.model.DoesNotExist:
                    pass

                avatar = self.model.save_avatar(
                    relation={self.object_type: obj},
                    type="upload",
                    avatar=avatar_photo,
                    filename=self.get_avatar_filename(obj),
                    color=result.get("color"),
                )

                try:
                    avatar.avatar_type = 2
                    avatar.save(update_fields=["avatar_type"])
                except Exception:
                    pass

                avatar.clear_cached_photos()
                return avatar, None
            elif prompt:
                # Generate new AI avatar for organization
                try:
                    # Enhance prompt for organization context
                    org_prompt = (
                        f"A professional organization logo or emblem representing: {prompt}"
                    )

                    logger.info(
                        "Generating organization AI avatar",
                        extra={"org_id": obj.id, "prompt": org_prompt},
                    )

                    # Use a dummy user ID of 1 to avoid organization-specific issues
                    # The avatar generation service expects a user_id but we can use a dummy value
                    try:
                        image_data = avatar_generation_service.generate_avatar(
                            prompt=org_prompt, user_id=1  # Use dummy user_id to avoid DB issues
                        )
                        logger.info("Avatar generation successful", extra={"org_id": obj.id})
                    except Exception as gen_error:
                        logger.exception(
                            "Avatar generation service failed",
                            extra={"org_id": obj.id, "error": str(gen_error)},
                        )
                        raise

                    image_file = InMemoryUploadedFile(
                        file=io.BytesIO(image_data),
                        field_name="avatar_photo",
                        name=f"org_avatar_{obj.slug}.png",
                        content_type="image/png",
                        size=len(image_data),
                        charset=None,
                    )

                    # Delete existing avatar to ensure we get a fresh ident and URL
                    try:
                        existing_avatar = self.model.objects.get(organization=obj)
                        existing_avatar.delete()
                        logger.info(
                            "Deleted existing organization avatar", extra={"org_id": obj.id}
                        )
                    except self.model.DoesNotExist:
                        pass  # No existing avatar to delete

                    try:
                        avatar = self.model.save_avatar(
                            relation={self.object_type: obj},
                            type="upload",  # Save as upload initially
                            avatar=image_file,
                            filename=self.get_avatar_filename(obj),
                            color=result.get("color"),
                        )
                        logger.info(
                            "Avatar file saved successfully",
                            extra={"org_id": obj.id, "new_ident": avatar.ident},
                        )
                    except Exception as save_error:
                        logger.exception(
                            "Failed to save organization avatar file",
                            extra={"org_id": obj.id, "error": str(save_error)},
                        )
                        raise

                    # Then update the avatar type to ai_generated
                    try:
                        avatar.avatar_type = 2  # AI_GENERATED = 2 for organizations
                        avatar.save(update_fields=["avatar_type"])
                        logger.info("Avatar type updated to ai_generated", extra={"org_id": obj.id})
                    except Exception as e:
                        logger.warning(
                            "Failed to set ai_generated type for organization avatar, keeping as upload",
                            extra={"org_id": obj.id, "error": str(e)},
                        )

                    # Clear avatar cache to ensure fresh images are served
                    avatar.clear_cached_photos()
                    logger.info("Cleared avatar cache", extra={"org_id": obj.id})

                    return avatar, org_prompt

                except AvatarGenerationError as e:
                    logger.exception(
                        "Organization AI avatar generation failed",
                        extra={"org_id": obj.id, "error": str(e)},
                    )
                    raise serializers.ValidationError({"ai_prompt": str(e)})
                except Exception as e:
                    logger.exception(
                        "Unexpected error in organization AI avatar generation",
                        extra={"org_id": obj.id, "error": str(e)},
                    )
                    raise serializers.ValidationError(
                        {"ai_prompt": "Avatar generation failed due to unexpected error"}
                    )
            else:
                # No prompt provided, just set avatar type for existing AI avatar
                return super().save_avatar(obj, serializer, **kwargs), None

        return super().save_avatar(obj, serializer, **kwargs), None

    def put(self, request, organization):
        """Override put to return full organization data for proper cache invalidation."""
        from rest_framework.response import Response

        # Call the parent put method to handle avatar saving
        super().put(request, organization=organization)

        # Instead of returning just the avatar, return the full organization
        # This ensures the frontend gets updated organization data with the new avatar
        return Response(serialize(organization, request.user))
