ISSUE_LOCKED_ERROR_MESSAGE = "Unable to create comment because issue is locked."

RATE_LIMITED_MESSAGE = "API rate limit exceeded"

# ---

# MERGED PR COMMENTS

MERGED_PR_METRICS_BASE = "github_pr_comment.{key}"

MERGED_PR_COMMENT_BODY_TEMPLATE = """## Suspect Issues
This pull request was deployed and Sentry observed the following issues:

{issue_list}

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""

MERGED_PR_SINGLE_ISSUE_TEMPLATE = "- ‼️ **{title}** `{subtitle}` [View Issue]({url})"

# ---

# OPEN PR COMMENTS

OPEN_PR_METRICS_BASE = "github_open_pr_comment.{key}"

# Caps the number of files that can be modified in a PR to leave a comment
OPEN_PR_MAX_FILES_CHANGED = 7
# Caps the number of lines that can be modified in a PR to leave a comment
OPEN_PR_MAX_LINES_CHANGED = 500

OPEN_PR_COMMENT_BODY_TEMPLATE = """## 🔍 Existing Issues For Review
Your pull request is modifying functions with the following pre-existing issues:

{issue_tables}
---

<sub>Did you find this useful? React with a 👍 or 👎</sub>"""

OPEN_PR_ISSUE_TABLE_TEMPLATE = """📄 File: **{filename}**

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}"""

OPEN_PR_ISSUE_TABLE_TOGGLE_TEMPLATE = """<details>
<summary><b>📄 File: {filename} (Click to Expand)</b></summary>

| Function | Unhandled Issue |
| :------- | :----- |
{issue_rows}
</details>"""

OPEN_PR_ISSUE_ROW_TEMPLATE = "| **`{function_name}`** | [**{title}**]({url}) {subtitle} <br> `Event Count:` **{event_count}** |"

OPEN_PR_ISSUE_DESCRIPTION_LENGTH = 52

# Number of stackframes to check for filename + function combo, starting from the top
STACKFRAME_COUNT = 6
