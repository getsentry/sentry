---
root: false
globs:
  - 'tests/**/*.py'
  - '**/test_*.py'
---

# Python Testing Best Practices

## Running Tests

```bash
# Run Python tests
pytest

# Run specific test file
pytest tests/sentry/api/test_base.py
```

## Testing Best Practices

### Python Tests

- Use pytest fixtures
- Mock external services
- Test database isolation with transactions
- Use factories for test data
- For Kafka/Arroyo components: Use `LocalProducer` with `MemoryMessageStorage` instead of mocks

### Test Pattern

```python
# tests/sentry/core/endpoints/test_organization_details.py
from sentry.testutils.cases import APITestCase

class OrganizationDetailsTest(APITestCase):
    endpoint = "sentry-api-0-organization-details"

    def test_get_organization(self):
        org = self.create_organization(owner=self.user)
        self.login_as(self.user)

        response = self.get_success_response(org.slug)
        assert response.data["id"] == str(org.id)
```
