"""
Service for generating AI-powered user avatars using OpenAI's latest GPT Image 1 API.
"""

from __future__ import annotations

import io
import logging

import requests
from openai import OpenAI
from PIL import Image

from sentry import options

logger = logging.getLogger(__name__)


class AvatarGenerationError(Exception):
    """Raised when avatar generation fails."""

    pass


class AvatarGenerationService:
    """Service for generating AI avatars using OpenAI's GPT Image 1 model."""

    def __init__(self):
        self._client = None

    def _get_openai_client(self) -> OpenAI:
        """Get configured OpenAI client for avatar generation."""
        import os

        # Prioritize user's personal OpenAI account
        api_key = os.environ.get("OPENAI_API_KEY")
        organization = os.environ.get("OPENAI_ORG_ID")
        project = os.environ.get("OPENAI_PROJECT_ID")

        # If user has their own API key, use it exclusively (don't fallback to Sentry config)
        if api_key:
            logger.info(
                "Using personal OpenAI API key",
                extra={
                    "has_api_key": True,
                    "has_organization": bool(organization),
                    "has_project": bool(project),
                },
            )
            client_kwargs = {"api_key": api_key}
            if organization:
                client_kwargs["organization"] = organization
            if project:
                client_kwargs["project"] = project
            return OpenAI(**client_kwargs)

        # Only fallback to Sentry's configuration if no personal key is provided
        if not api_key:
            try:
                provider_options = options.get("llm.provider.options", {})
                openai_config = provider_options.get("openai", {})
                api_key = openai_config.get("options", {}).get("api_key")

                logger.info(
                    "Checking OpenAI configuration",
                    extra={
                        "provider_options": provider_options,
                        "openai_config": openai_config,
                        "has_api_key": bool(api_key),
                    },
                )
            except Exception as e:
                logger.warning(
                    "Failed to read from options system",
                    extra={"error": str(e)},
                )

        if not api_key:
            try:
                from sentry.utils import json

                sentry_options_str = os.environ.get("SENTRY_OPTIONS")
                if sentry_options_str:
                    sentry_options = json.loads(sentry_options_str)
                    llm_options = sentry_options.get("llm.provider.options", {})
                    openai_options = llm_options.get("openai", {})
                    api_key = openai_options.get("options", {}).get("api_key")

                    logger.info(
                        "Found API key in SENTRY_OPTIONS",
                        extra={"has_api_key": bool(api_key)},
                    )
            except Exception as e:
                logger.warning(
                    "Failed to parse SENTRY_OPTIONS",
                    extra={"error": str(e)},
                )

        if not api_key:
            raise AvatarGenerationError(
                "OpenAI API key not configured. Please set one of:\n"
                "1. OPENAI_API_KEY environment variable\n"
                "2. llm.provider.options.openai.options.api_key in Sentry options\n"
                "3. SENTRY_OPTIONS environment variable with proper JSON structure"
            )

        # Use the fallback API key if found
        return OpenAI(api_key=api_key)

    @property
    def client(self) -> OpenAI:
        """Lazy-load the OpenAI client."""
        if self._client is None:
            self._client = self._get_openai_client()
        return self._client

    def generate_avatar(self, prompt: str | None = None, user_id: int | None = None) -> bytes:
        try:
            if not prompt:

                prompt = "A highly realistic portrait photo of [random character/animal/object] doing something unusual [random action/outfit/prop], captured with professional photography style, natural lighting, sharp focus, humorous but natural, perfect for a profile picture."

            logger.info(
                "Generating AI avatar",
                extra={
                    "user_id": user_id,
                    "prompt": prompt,
                },
            )

            # Try latest model first, fallback to DALL-E 3 if not accessible yet
            try:
                response = self.client.images.generate(
                    model="gpt-image-1",
                    prompt=prompt,
                    size="1024x1024",
                    quality="high",
                    n=1,
                )
            except Exception as e:
                # If gpt-image-1 isn't accessible yet, fallback to DALL-E 3
                if "must be verified" in str(e) or "gpt-image-1" in str(e):
                    logger.info(
                        "Falling back to DALL-E 3 while waiting for gpt-image-1 access",
                        extra={"error": str(e), "user_id": user_id},
                    )
                    response = self.client.images.generate(
                        model="dall-e-3",
                        prompt=prompt,
                        size="1024x1024",
                        quality="hd",
                        n=1,
                    )
                else:
                    raise

            image_url = response.data[0].url
            if not image_url:
                raise AvatarGenerationError("No image URL returned from OpenAI")

            image_response = requests.get(image_url, timeout=30)
            image_response.raise_for_status()

            # Process image to ensure it's square and properly sized
            image_data = self._process_image(image_response.content)

            logger.info(
                "AI avatar generated successfully",
                extra={
                    "user_id": user_id,
                    "image_size": len(image_data),
                },
            )

            return image_data
        except Exception as e:
            logger.exception(
                "Failed to generate AI avatar",
                extra={
                    "user_id": user_id,
                    "prompt": prompt,
                    "error": str(e),
                },
            )
            raise AvatarGenerationError(f"Avatar generation failed: {str(e)}") from e

    def _process_image(self, image_data: bytes) -> bytes:
        """Process the generated image to ensure proper format and size."""
        try:
            # Open image and ensure it's RGB
            with Image.open(io.BytesIO(image_data)) as img:
                # Convert to RGB if necessary
                if img.mode != "RGB":
                    img = img.convert("RGB")

                # Ensure image is square (crop if needed)
                width, height = img.size
                if width != height:
                    # Crop to square from center
                    size = min(width, height)
                    left = (width - size) // 2
                    top = (height - size) // 2
                    right = left + size
                    bottom = top + size
                    img = img.crop((left, top, right, bottom))

                # Resize to standard avatar size (512x512 for good quality)
                img = img.resize((512, 512), Image.Resampling.LANCZOS)

                # Save as PNG
                output = io.BytesIO()
                img.save(output, format="PNG", optimize=True)
                return output.getvalue()
        except Exception as e:
            logger.warning(
                "Failed to process generated image, using original",
                extra={"error": str(e)},
            )
            # Return original if processing fails
            return image_data


# Global service instance
avatar_generation_service = AvatarGenerationService()
