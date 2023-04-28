import logging

from sentry_sdk import configure_scope

logger = logging.getLogger(__name__)


def clear_tags_and_context() -> None:
    """Clear certain tags and context since it should not be set."""
    reset_values = False
    with configure_scope() as scope:
        for tag in ["organization", "organization.slug"]:
            if tag in scope._tags:
                reset_values = True
                del scope._tags[tag]

        if "organization" in scope._contexts:
            reset_values = True
            del scope._contexts["organization"]

        if reset_values:
            logger.info("We've reset the context and tags.")
