# Sentry Testing Infrastructure Overview

## Summary
This Sentry codebase has a comprehensive testing infrastructure with multiple types of tests and sophisticated configuration. Here's what I discovered when you said "test":

## Testing Framework & Configuration

### **pytest** (Primary Testing Framework)
- **Version**: 8.4.1 installed
- **Configuration**: Located in `pyproject.toml`
- **Custom Markers Available**:
  - `snuba` - Tests requiring Snuba access
  - `sentry_metrics` - Tests requiring Sentry metrics
  - `symbolicator` - Tests requiring Symbolicator access
  - `querybuilder` - QueryBuilder smoke tests

### **Test Discovery Pattern**
- Files: `test_*.py` and `sentry/testutils/*`
- Configuration: `--tb=short -p no:celery --nomigrations`

## Available Test Commands (from Makefile)

### **Python Tests**
- `make test-python-ci` - Main Python test suite
- `make test-monolith-dbs` - Database-specific tests (with `SENTRY_USE_MONOLITH_DBS=1`)
- `make test-tools` - Tools tests
- `make test-cli` - CLI functionality tests

### **JavaScript Tests**
- `make test-js` - JavaScript tests
- `make test-js-ci` - CI JavaScript tests

### **Specialized Tests**
- `make test-acceptance` - Acceptance tests (requires building static assets)
- `make test-api-docs` - API documentation tests
- `make test-symbolicator` - Symbolicator tests
- `make test-relay-integration` - Relay integration tests

## Test Structure & Organization

### **Main Test Directory**: `tests/`
Contains specialized subdirectories:
- `tests/sentry/` - Core Sentry functionality tests (119+ subdirectories)
- `tests/acceptance/` - Acceptance tests
- `tests/js/` - JavaScript tests
- `tests/apidocs/` - API documentation tests
- `tests/symbolicator/` - Symbolicator tests
- `tests/relay_integration/` - Relay integration tests

### **Sample Test Files Found**:
- `tests/sentry/test_dependencies.py` - Dependency validation tests
- `tests/sentry/test_constants.py` - Constants and integration tests
- `tests/sentry/test_http.py` - HTTP functionality tests
- `tests/sentry/test_stacktraces.py` - Stacktrace processing tests

## Testing Fixtures & Infrastructure

### **Extensive Test Fixtures** in `tests/conftest.py`:
- **File leak detection** - Ensures tests don't leak file descriptors
- **Silo mode validation** - Validates hybrid cloud configurations
- **Transaction enforcement** - Prevents cross-transaction interactions
- **Cache clearing** - Automatic cache cleanup between tests
- **Signal leak detection** - Ensures OS signal handlers are cleaned up
- **Response mock validation** - Prevents leaked mock configurations

### **Hybrid Cloud Testing Support**
- Simulates multiple application configurations
- Outbox message validation for cross-service communications
- Protected query validation for hybrid cloud foreign keys

## Requirements & Dependencies

### **Development Dependencies** (`requirements-dev.txt`):
- `pytest>=8.1` with extensions:
  - `pytest-cov>=4.0.0` - Coverage reporting
  - `pytest-django>=4.9.0` - Django integration
  - `pytest-xdist>=3` - Parallel test execution
  - `pytest-rerunfailures>=15` - Flaky test handling
- `docker>=7` - Container support
- `selenium>=4.16.0` - Browser automation for acceptance tests

### **Code Quality Tools**:
- `black>=24.10.0` - Code formatting
- `flake8>=7.3` - Linting
- `mypy>=1.15` - Type checking

## Test Output & Reporting

### **Artifact Generation**:
- Coverage reports: `.artifacts/python.coverage.xml`
- Test results: `.artifacts/pytest.json`
- JUnit XML: `.artifacts/pytest.junit.xml`

### **Advanced Features**:
- **Snapshot testing** - For regression testing with `cargo-insta`
- **GitHub Actions integration** - Custom pytest annotations
- **Parallel execution** - Support for distributed testing
- **Flaky test handling** - Automatic retry capabilities

## Environment Setup

The codebase expects a full development environment with:
- Python 3.13+ with virtual environment support
- Node.js/pnpm for JavaScript tests
- Docker for integration tests
- Database setup for Django tests

## Running Tests

To run tests in this environment:

1. **Set up virtual environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements-dev.txt
   ```

3. **Run specific test types**:
   ```bash
   # Basic Python tests
   make test-python-ci

   # JavaScript tests
   make test-js

   # Acceptance tests
   make test-acceptance
   ```

## Key Insights

This is a **production-grade testing infrastructure** for a large-scale application with:
- **Comprehensive coverage** across multiple languages and services
- **Sophisticated isolation** preventing test interference
- **Hybrid cloud awareness** for microservice architectures
- **CI/CD integration** with detailed reporting
- **Performance considerations** with parallel execution support

The testing setup demonstrates enterprise-level best practices for a complex, distributed system like Sentry's error monitoring platform.
