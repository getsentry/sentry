# Investigation: Is there a 250 commit limit per release in Sentry?

## Background

From Slack #discuss-integrations (2/9/2026):

> Canva (enterprise customer) wrote in asking about github integration and commits associated with releases. They're finding that some authors are missing in the author list of those releases. It doesn't seem to be tied to single user or commit. Username and email between github and sentry is consistent. What could be the issue here? Can only 250 commits be associated to a release and if that's the case any commit authors after the 250 cut off will be left out?

## Investigation Summary

**Conclusion: There is NO 250 commit limit per release in Sentry.**

## Detailed Findings

### 1. API Serializer (No Limit)

**File:** `src/sentry/api/serializers/rest_framework/release.py`

```python
commits = serializers.ListField(
    child=CommitSerializer(),
    required=False,
    allow_null=False,
    help_text="An optional list of commit data to be associated.",
)
```

- No `max_length` parameter on the `ListField`
- Unlimited commits can be sent via API

### 2. Database Model (No Limit)

**File:** `src/sentry/models/release.py`

```python
authors = ArrayField(models.TextField(), default=list, null=True)
```

- PostgreSQL `ArrayField` with no size constraint
- Arrays in PostgreSQL can theoretically hold up to 2GB per element

### 3. Commit Processing (No Limit)

**File:** `src/sentry/models/releases/set_commits.py`

Lines 97-108 show how authors are populated:

```python
release.update(
    commit_count=len(commit_list),
    authors=[
        str(a_id)
        for a_id in ReleaseCommit.objects.filter(
            release=release, commit__author_id__isnull=False
        )
        .values_list("commit__author_id", flat=True)
        .distinct()
    ],
    last_commit_id=latest_commit.id if latest_commit else None,
)
```

- **No `[:250]` slice** or any limit on the `.distinct()` query
- All unique commit authors are captured

### 4. Historical Context

Recent commits show improvements but no limits:

- **d082f857506** (Jan 15, 2026): "perf(releases): Batch CommitAuthor queries" - Optimized to handle any number of authors efficiently, reducing queries from 2N+ to at most 4 queries
- **b40ad28a1fb** (2024): "ref: improve release serializer where Release.authors is None" - Bug fix for null authors
- **668079e47cd**: "feat(releases): Increase max commit author email length" - Increased email length, not commit count limits

### 5. Constants

The only "250" constant found is:

```python
DB_VERSION_LENGTH = 250  # Maximum length for version STRING, not commit count
```

This is for the release version string length (e.g., "1.0.0"), NOT for commit counts.

## Possible Causes of Missing Authors

If Canva is experiencing missing authors, it's likely NOT due to a 250 limit. Possible causes:

1. **Commits without authors**: Some commits may have `author_id__isnull=True` and are filtered out
2. **Email mismatches**: Author matching is case-insensitive but requires exact email matches
3. **Race conditions**: If multiple releases are created rapidly, the locking mechanism might cause some commits to fail
4. **Query timeouts**: For extremely large commit sets (1000s), database queries might timeout
5. **Pagination in UI**: The frontend paginates commits at 40 per page, which might make it seem like commits are missing
6. **API client issues**: The Sentry CLI or other client might be truncating the commit list before sending

## Test Coverage

Created comprehensive test in `tests/sentry/models/test_release_commit_author_limit.py`:

- `test_release_with_more_than_250_commit_authors()`: Tests 300 commits with 300 distinct authors
- `test_release_with_exactly_250_commit_authors()`: Tests exactly 250 commits as a baseline
- `test_release_authors_query_efficiency()`: Tests 350 commits and verifies query correctness

## Recommendation

To help Canva debug their issue:

1. **Check the actual commit count**: Have them query their release to see `release.commit_count` and `len(release.authors)`
2. **Verify author emails**: Ensure all commits have valid author emails
3. **Check for duplicate authors**: Multiple commits by the same author only appear once in the authors list
4. **Review API logs**: Check if the full commit list is being sent to Sentry
5. **Database query**: Run a direct query on their release to verify all authors are stored:
   ```sql
   SELECT count(*) FROM sentry_releasecommit WHERE release_id = <their_release_id>;
   ```

## Files Modified

- `tests/sentry/models/test_release_commit_author_limit.py` (new)
- `INVESTIGATION_FINDINGS.md` (this file)
