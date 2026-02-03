# Solution Summary: Multi-Project Code Mappings Support

## Problem Statement

Code mappings previously had a unique constraint on `(project, stack_root)`, which prevented configuring multiple source folders for the same stack trace path pattern. This created a limitation for multi-project repositories (common in .NET solutions) where:

- Multiple projects live in different subfolders (e.g., `ProjectA/`, `ProjectB/`, `ProjectC/`)
- Stack traces show relative paths without project identifiers (e.g., `Services/Foo.cs`)
- The same relative path structure exists across multiple project folders

Users could not get stack trace linking to work for all projects in their solution - only one folder could be mapped per stack trace root.

## Solution Implemented

The solution removes the unique constraint and allows multiple code mappings with the same `stack_root` for the same project. The stacktrace linking logic already iterates through all matching configs and tries each one until a file is found, so no changes to the linking logic were needed.

### Changes Made

#### 1. Database Migration (`src/sentry/migrations/1025_remove_code_mapping_unique_constraint.py`)

Created a migration to remove the `unique_together` constraint on `(project, stack_root)` from the database schema.

```python
operations = [
    migrations.AlterUniqueTogether(
        name="repositoryprojectpathconfig",
        unique_together=set(),
    ),
]
```

#### 2. Model Update (`src/sentry/integrations/models/repository_project_path_config.py`)

Removed the `unique_together` constraint from the model's `Meta` class:

```python
class Meta:
    app_label = "sentry"
    db_table = "sentry_repositoryprojectpathconfig"
    # Removed: unique_together = (("project", "stack_root"),)
```

#### 3. Serializer Update (`src/sentry/integrations/api/endpoints/organization_code_mappings.py`)

Removed the validation that prevented duplicate `stack_root` values for the same project:

```python
def validate(self, attrs):
    # Allow multiple code mappings with the same stack_root for the same project
    # This enables multi-project repositories where different source folders
    # share the same relative path structure
    return attrs
```

#### 4. Test Updates

**Updated existing test** (`tests/sentry/integrations/api/endpoints/test_organization_code_mappings.py`):

- Modified `test_validate_path_conflict` to verify that multiple mappings with the same `stack_root` are now allowed

**Added comprehensive test** for multi-project scenario:

- `test_multi_project_repository_same_stack_root`: Simulates a .NET solution with three projects sharing the same path structure

**Added stacktrace linking test** (`tests/sentry/issues/endpoints/test_project_stacktrace_link.py`):

- `test_multi_project_repository_tries_multiple_mappings`: Verifies that the system tries each mapping sequentially until a file is found

## How It Works

### Example: .NET Solution with Multiple Projects

Consider a repository structure:

```
repo/
├── ProjectA/
│   └── Services/
│       └── Foo.cs
├── ProjectB/
│   └── Services/
│       └── Bar.cs
└── ProjectC/
    └── Services/
        └── Baz.cs
```

Stack traces show: `Services/Foo.cs` (without project identifier)

### Code Mappings Configuration

Users can now create multiple code mappings:

1. **Mapping 1**: `stack_root: "Services/"` → `source_root: "ProjectA/Services/"`
2. **Mapping 2**: `stack_root: "Services/"` → `source_root: "ProjectB/Services/"`
3. **Mapping 3**: `stack_root: "Services/"` → `source_root: "ProjectC/Services/"`

### Linking Process

When a stack trace references `Services/Foo.cs`:

1. System finds all mappings with matching `stack_root: "Services/"`
2. Tries first mapping: Looks for `ProjectA/Services/Foo.cs` ✓ Found!
3. Returns link to the file in ProjectA

When a stack trace references `Services/Baz.cs`:

1. System finds all mappings with matching `stack_root: "Services/"`
2. Tries first mapping: Looks for `ProjectA/Services/Baz.cs` ✗ Not found
3. Tries second mapping: Looks for `ProjectB/Services/Baz.cs` ✗ Not found
4. Tries third mapping: Looks for `ProjectC/Services/Baz.cs` ✓ Found!
5. Returns link to the file in ProjectC

## Benefits

1. **Multi-project repository support**: Users can configure multiple source folders for the same stack trace pattern
2. **No manual project identification needed**: The system automatically finds the correct file by trying each mapping
3. **Backward compatible**: Existing single-mapping configurations continue to work
4. **Zero changes to linking logic**: The iteration mechanism was already in place in `get_stacktrace_config()`

## Testing

All changes have been committed and pushed to the branch `cursor/ID-1314-multi-project-code-mappings-049f`.

### Test Coverage

1. ✅ Validation no longer prevents duplicate stack_roots
2. ✅ Multiple mappings with same stack_root can be created
3. ✅ GET endpoint returns all mappings including duplicates
4. ✅ Stacktrace linking tries multiple mappings sequentially
5. ✅ Correct mapping is selected when file is found

## Migration Steps

1. Apply migration `1025_remove_code_mapping_unique_constraint.py`
2. Deploy code changes
3. Users can now create multiple code mappings with the same `stack_root`

## Additional Notes

- The sorting logic in `get_sorted_code_mapping_configs()` ensures user-defined mappings are tried before auto-generated ones
- More specific stack roots are tried before less specific ones
- Absolute path stack roots are tried before relative path stack roots
- No breaking changes to existing functionality
