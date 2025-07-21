from sentry.preprod.models import PreprodArtifact


def is_installable_artifact(artifact: PreprodArtifact) -> bool:
    # TODO: Adjust this logic when we have a better way to determine if an artifact is installable
    return artifact.installable_app_file_id is not None
