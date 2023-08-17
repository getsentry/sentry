from sentry.deletions import default_manager
from sentry.deletions.base import _delete_children
from sentry.deletions.defaults.repository import _get_repository_child_relations
from sentry.models.repository import Repository
from sentry.silo import SiloMode
from sentry.tasks.base import instrumented_task


@instrumented_task(
    name="sentry.models.repository_cascade_delete_on_hide",
    acks_late=True,
    silo_mode=SiloMode.REGION,
)
def repository_cascade_delete_on_hide(repo_id: int) -> None:
    # Manually cause a deletion cascade.
    # This should be called after setting a repo's status
    # to ObjectStatus.HIDDEN.
    # References RepositoryDeletionTask and BaseDeletionTask logic.

    try:
        repo = Repository.objects.get(id=repo_id)
    except Repository.DoesNotExist:
        return

    has_more = True

    while has_more:
        # get child relations
        child_relations = _get_repository_child_relations(repo)
        # extend relations
        child_relations = child_relations + [
            rel(repo) for rel in default_manager.dependencies[Repository]
        ]
        # no need to filter relations; delete them
        if child_relations:
            has_more = _delete_children(manager=default_manager, relations=child_relations)
