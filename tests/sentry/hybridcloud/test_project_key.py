"""
Tests for ``ProjectKeyService`` RPC methods used by the Stripe Projects
integration (``create_project_key``, ``delete_project_key``). These
replace raw HTTP self-calls (``cell_request``) to the cell silo's
``/api/0/projects/.../keys/`` endpoint.

The scoping guarantees matter here because the ``public_key`` argument
is user-controllable: without org+project scoping, a stolen or
malformed public_key could delete keys from unrelated projects.
"""

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.models.projectkey import ProjectKey
from sentry.projects.services.project_key.service import project_key_service
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all


@django_db_all(transaction=True)
def test_create_project_key_happy_path() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)

    rpc_key = project_key_service.create_project_key(
        organization_id=org.id,
        project_id=project.id,
        label="Stripe Projects",
    )

    assert rpc_key is not None
    # Key actually exists in the database tied to the right project.
    db_key = ProjectKey.objects.get(public_key=rpc_key.public_key)
    assert db_key.project_id == project.id
    assert db_key.label == "Stripe Projects"


@django_db_all(transaction=True)
def test_create_project_key_missing_project_returns_none() -> None:
    org = Factories.create_organization()

    result = project_key_service.create_project_key(
        organization_id=org.id,
        project_id=999_999_999,
        label="whatever",
    )

    assert result is None


@django_db_all(transaction=True)
def test_create_project_key_wrong_org_returns_none() -> None:
    """Org A can't create a key on a project that belongs to org B."""
    org_a = Factories.create_organization()
    org_b = Factories.create_organization()
    project = Factories.create_project(organization=org_a)

    result = project_key_service.create_project_key(
        organization_id=org_b.id,
        project_id=project.id,
        label="cross-org",
    )

    assert result is None
    # Confirm no key was created on the actual project.
    assert not ProjectKey.objects.filter(project_id=project.id, label="cross-org").exists()


@django_db_all(transaction=True)
def test_create_project_key_label_none_is_allowed() -> None:
    """A None label is accepted; ProjectKey.save() generates a random
    petname on its own so the row is never label-less. Documents the
    behavior so callers don't pre-generate labels assuming None is
    unusable."""
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)

    rpc_key = project_key_service.create_project_key(
        organization_id=org.id,
        project_id=project.id,
        label=None,
    )

    assert rpc_key is not None
    db_key = ProjectKey.objects.get(public_key=rpc_key.public_key)
    # Petname generation means label is non-empty even though we passed None.
    assert db_key.label


@django_db_all(transaction=True)
def test_delete_project_key_happy_path() -> None:
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)

    result = project_key_service.delete_project_key(
        organization_id=org.id,
        project_id=project.id,
        public_key=key.public_key,
    )

    assert result is True
    assert not ProjectKey.objects.filter(id=key.id).exists()


@django_db_all(transaction=True)
def test_delete_project_key_nonexistent_returns_false() -> None:
    """A public_key value that doesn't match any key returns False
    instead of raising, so callers can safely replay a delete."""
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)

    result = project_key_service.delete_project_key(
        organization_id=org.id,
        project_id=project.id,
        public_key="nonexistent-public-key-00000000",
    )

    assert result is False


@django_db_all(transaction=True)
def test_delete_project_key_wrong_project_returns_false() -> None:
    """A real public_key for project A can't be deleted via project B's
    id. Guards against a scenario where public_key is known but
    project_id is spoofed."""
    org = Factories.create_organization()
    project_a = Factories.create_project(organization=org)
    project_b = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project_a)

    result = project_key_service.delete_project_key(
        organization_id=org.id,
        project_id=project_b.id,
        public_key=key.public_key,
    )

    assert result is False
    # Key on project_a is untouched.
    assert ProjectKey.objects.filter(id=key.id).exists()


@django_db_all(transaction=True)
def test_delete_project_key_wrong_org_returns_false() -> None:
    """A real public_key for org A's project can't be deleted via org
    B's id, even if project_id is guessed correctly. This is the
    primary IDOR guard on this endpoint."""
    org_a = Factories.create_organization()
    org_b = Factories.create_organization()
    project = Factories.create_project(organization=org_a)
    key = Factories.create_project_key(project=project)

    result = project_key_service.delete_project_key(
        organization_id=org_b.id,
        project_id=project.id,
        public_key=key.public_key,
    )

    assert result is False
    assert ProjectKey.objects.filter(id=key.id).exists()


@django_db_all(transaction=True)
def test_delete_project_key_refuses_internal_keys() -> None:
    """Internal keys (PROFILING, TEMPEST, DEMO) must be protected from
    RPC deletion to match the HTTP endpoint's ``for_request`` filter.
    Stripe Projects only ever creates USER keys via create_project_key,
    so this is hardening against a caller that somehow supplies a known
    internal key's public_key."""
    from sentry.models.projectkey import UseCase

    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    # Manually create an internal key since Factories.create_project_key
    # defaults to USER.
    internal_key = Factories.create_project_key(project=project)
    internal_key.update(use_case=UseCase.PROFILING.value)

    result = project_key_service.delete_project_key(
        organization_id=org.id,
        project_id=project.id,
        public_key=internal_key.public_key,
    )

    assert result is False
    assert ProjectKey.objects.filter(id=internal_key.id).exists()


@django_db_all(transaction=True)
def test_delete_project_key_emits_outbox() -> None:
    """The reason we fetch-then-delete (rather than
    ``ProjectKey.objects.filter(...).delete()``) is that QuerySet.delete()
    bypasses the per-instance override on ``CellOutboxProducingModel``
    that emits the replication outbox. This test asserts the outbox IS
    emitted so a "performance optimization" back to QuerySet.delete()
    fails loudly."""
    org = Factories.create_organization()
    project = Factories.create_project(organization=org)
    key = Factories.create_project_key(project=project)
    key_id = key.id

    # Clear any outboxes from key creation so we can assert specifically
    # on the delete-emitted outbox.
    CellOutbox.objects.filter(
        category=OutboxCategory.PROJECT_KEY_UPDATE.value,
        object_identifier=key_id,
    ).delete()

    result = project_key_service.delete_project_key(
        organization_id=org.id,
        project_id=project.id,
        public_key=key.public_key,
    )

    assert result is True
    assert not ProjectKey.objects.filter(id=key_id).exists()
    # Delete outbox must exist so the control-silo replica also gets
    # cleaned up. Without this, stale replica rows would continue to
    # validate DSN lookups and auth checks for a deleted key.
    assert CellOutbox.objects.filter(
        category=OutboxCategory.PROJECT_KEY_UPDATE.value,
        object_identifier=key_id,
    ).exists()
