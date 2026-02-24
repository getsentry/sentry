# Output Patterns

Patterns for producing consistent, high-quality output from skills.

## Template Pattern

Provide templates when the skill must produce a specific format. Match strictness to requirements.

**Strict (for API responses, reports, data formats):**

```markdown
## Report structure

ALWAYS use this exact template:

# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```

**Flexible (when adaptation is useful):**

```markdown
## Report structure

Use this as a sensible default, but adapt based on context:

# [Analysis Title]

## Executive summary
[Overview]

## Key findings
[Adapt sections based on what you discover]

## Recommendations
[Tailor to the specific context]
```

## Examples Pattern

When output quality depends on style or format, provide input/output pairs:

````markdown
## Commit message format

Generate commit messages following these examples:

**Example 1:**
Input: Added user authentication with JWT tokens
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Example 2:**
Input: Fixed bug where dates displayed incorrectly
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

Follow this style: type(scope): brief description, then detailed explanation.
````

Examples help agents understand desired style and detail level more clearly than descriptions alone.

## Decision Table Pattern

Use tables when the output format depends on input characteristics:

```markdown
## Output format selection

| Input Type | Output Format | Example |
|-----------|--------------|---------|
| Single file | Inline summary | "Found 3 issues in auth.py: ..." |
| Multiple files | Grouped report | Markdown report with per-file sections |
| Full repository | Executive summary + details | Summary table + expandable sections |
```

## Structured Data Pattern

When scripts or downstream tools consume the output, specify the exact schema:

````markdown
## Output format

Return results as JSON:

```json
{
  "status": "success" | "failure",
  "findings": [
    {
      "severity": "HIGH" | "MEDIUM" | "LOW",
      "file": "path/to/file.py",
      "line": 42,
      "message": "Description of the finding"
    }
  ],
  "summary": "One-line summary of results"
}
```
````
