# Endpoint Silo Test Reference

## Import Block

```python
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import (
    control_silo_test,
    region_silo_test,
    no_silo_test,
    assume_test_silo_mode,
    assume_test_silo_mode_of,
    create_test_regions,
)
from sentry.silo.base import SiloMode
```

## Decorator Mapping

Match the endpoint's silo decorator to the test's silo decorator:

| Endpoint Decorator                           | Test Decorator                                          |
| -------------------------------------------- | ------------------------------------------------------- |
| `@region_silo_endpoint`                      | `@region_silo_test`                                     |
| `@control_silo_endpoint`                     | `@control_silo_test`                                    |
| `@control_silo_endpoint` (proxies to region) | `@control_silo_test(regions=create_test_regions("us"))` |
| No silo decorator                            | `@no_silo_test`                                         |

## Template: Region Silo Endpoint Test

```python
@region_silo_test
class Test{Endpoint}(APITestCase):
    endpoint = "sentry-api-0-{endpoint-name}"

    def setUp(self):
        super().setUp()
        # Factory calls: no silo wrapper needed
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.organization)
        self.login_as(self.user)

    def test_get_success(self):
        """Verify successful GET returns expected data."""
        response = self.get_success_response(
            self.organization.slug,
            self.project.slug,
        )
        assert response.data["id"] == str(self.project.id)

    def test_get_unauthorized(self):
        """Verify unauthenticated request returns 401."""
        self.login_as(self.create_user())  # different user, no access
        self.get_error_response(
            self.organization.slug,
            self.project.slug,
            status_code=403,
        )

    def test_post_creates_resource(self):
        """Verify POST creates the resource."""
        response = self.get_success_response(
            self.organization.slug,
            method="post",
            name="new-resource",
            status_code=201,
        )
        assert response.data["name"] == "new-resource"
```

## Template: Control Silo Endpoint Test

```python
@control_silo_test
class Test{Endpoint}(APITestCase):
    endpoint = "sentry-api-0-{endpoint-name}"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.login_as(self.user)

    def test_get_success(self):
        """Verify successful GET for control-silo resource."""
        response = self.get_success_response()
        assert response.data["id"] == str(self.user.id)
```

## Template: Endpoint with Cross-Silo Data Verification

```python
@region_silo_test
class Test{Endpoint}CrossSilo(APITestCase):
    endpoint = "sentry-api-0-{endpoint-name}"

    def setUp(self):
        super().setUp()
        # Factory calls handle silo mode automatically
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(self.user)

    def test_response_includes_cross_silo_data(self):
        """Verify response includes data from the other silo."""
        response = self.get_success_response(self.organization.slug)

        # Verify response against ORM data in the other silo
        with assume_test_silo_mode_of({ControlModel}):
            control_obj = {ControlModel}.objects.get(
                organization_id=self.organization.id,
            )
        assert response.data["{field}"] == str(control_obj.id)
```

## Template: Endpoint with Permission Scopes

```python
@region_silo_test
class Test{Endpoint}Permissions(APITestCase):
    endpoint = "sentry-api-0-{endpoint-name}"

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        self.login_as(self.user)

    def test_member_cannot_delete(self):
        """Verify members without admin scope get 403."""
        member_user = self.create_user()
        self.create_member(
            organization=self.organization,
            user=member_user,
            role="member",
        )
        self.login_as(member_user)
        self.get_error_response(
            self.organization.slug,
            method="delete",
            status_code=403,
        )

    def test_admin_can_delete(self):
        """Verify admins with correct scope can delete."""
        self.get_success_response(
            self.organization.slug,
            method="delete",
            status_code=204,
        )
```

## Key Patterns

- **`APITestCase`** is the standard base class for endpoint tests. It provides `get_success_response()`, `get_error_response()`, `self.client`, and `self.login_as()`.
- **`endpoint` class attribute** should match the URL name registered in `urls.py`. Enables `get_success_response()` / `get_error_response()` helpers.
- **Factory calls** (`self.create_user()`, `self.create_organization()`, etc.) must NEVER be wrapped in `assume_test_silo_mode`. Factories are silo-aware.
- **`assume_test_silo_mode_of(Model)`** is only needed when doing direct ORM queries for verification against the response, not for test setup.
- **Permission tests** should cover at minimum: unauthenticated (401), unauthorized role (403), and authorized (200/201/204).
- **Response data** uses string IDs (`str(obj.id)`) for numeric fields — Sentry's API convention.
