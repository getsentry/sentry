from sentry.models.projectkeymapping import ProjectKeyMapping
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test, create_test_cells


@django_db_all(transaction=True)
@cell_silo_test(regions=create_test_cells("us"), include_monolith_run=True)
def test_project_key_mapping_claimed_on_create() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)

    with assume_test_silo_mode(SiloMode.CONTROL):
        mapping = ProjectKeyMapping.objects.get(public_key=key.public_key)
        assert mapping.cell_name
        assert mapping.project_key_id == key.id


@django_db_all(transaction=True)
@cell_silo_test(regions=create_test_cells("us"), include_monolith_run=True)
def test_project_key_mappings_deleted_on_project_delete() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)
    public_key = key.public_key

    with outbox_runner():
        project.delete()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert not ProjectKeyMapping.objects.filter(public_key=public_key).exists()


@django_db_all(transaction=True)
@cell_silo_test(regions=create_test_cells("us"), include_monolith_run=True)
def test_project_key_mapping_deleted_on_key_delete() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)
    public_key = key.public_key

    with outbox_runner():
        key.delete()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert not ProjectKeyMapping.objects.filter(public_key=public_key).exists()


@django_db_all(transaction=True)
@cell_silo_test(regions=create_test_cells("us"), include_monolith_run=True)
def test_project_key_mapping_no_orphan_when_delete_coalesces_with_key_update() -> None:
    """Deletion after a public_key change must not orphan the mapping when outboxes coalesce."""
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)
    key_id = key.id

    # Flush creation outbox so a mapping row exists under the original public_key.
    with outbox_runner():
        pass

    # Change public_key then immediately delete — the two outboxes coalesce into one
    # carrying the new public_key.  Deletion must still find the mapping by project_key_id.
    key.public_key = key.generate_api_key()
    key.save()
    key.delete()

    with outbox_runner():
        pass

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert not ProjectKeyMapping.objects.filter(project_key_id=key_id).exists()


@django_db_all(transaction=True)
@cell_silo_test(regions=create_test_cells("us"), include_monolith_run=True)
def test_project_key_mapping_no_orphan_on_public_key_override() -> None:
    """
    When write_relocation_import overwrites an auto-created ProjectKey with a different
    public_key, the mapping for the auto-generated public_key must be replaced rather than
    leaving an orphaned mapping in the control silo alongside the new one.
    """
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)
    auto_public_key = key.public_key

    # Simulate write_relocation_import overriding the public_key with an imported value.
    key.public_key = key.generate_api_key()
    key.save()

    with assume_test_silo_mode(SiloMode.CONTROL):
        assert not ProjectKeyMapping.objects.filter(public_key=auto_public_key).exists()
        assert ProjectKeyMapping.objects.filter(
            public_key=key.public_key, project_key_id=key.id
        ).exists()
