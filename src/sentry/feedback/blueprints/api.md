# Feedback API

Host: https://sentry.io/api/0

**Authors.**

@cmanallen

**How to read this document.**

This document is structured by resource with each resource having actions that
can be performed against it. Every action that either accepts a request or
returns a response _will_ document the full interchange format. Clients may opt
to restrict response data or provide a subset of the request data. The API may
or may not accept partial payloads.

## Feedback Category Generation [/organizations/<organization_id_or_slug>/feedback-categories/]

- Parameters
  - project (optional, string)
  - statsPeriod (optional, string) - A positive integer suffixed with a unit type. Default: 7d, Members
    - s
    - m
    - h
    - d
    - w
  - start (optional, string) - ISO 8601 format (`YYYY-MM-DDTHH:mm:ss.sssZ`)
  - end (optional, string) - ISO 8601 format. Required if `start` is set.
  - utc (optional, boolean) - Whether start/end should use the UTC timezone.

### Fetch Categories [GET]

Retrieves a list of categories, which comprise of a primary label, along with their associated labels, which are either directly interchangeable or children of the primary label (based on the feedbacks as context for what "interchangeable" means). Categories are returned in descending order with respect to the feedback count.

**Attributes**

| Column                         | Type            | Description                                                                            |
| ------------------------------ | --------------- | -------------------------------------------------------------------------------------- |
| categories                     | optional[array] | Array with each item representing a category                                           |
| categories[i].primaryLabel     | str             | The primary label of the category                                                      |
| categories[i].associatedLabels | list[str]       | The list of associated labels for a given primary label                                |
| categories[i].feedbackCount    | int             | Number of feedbacks that have either the primary label or any of the associated labels |
| numFeedbacksContext            | int             | Number of feedbacks given as context to the LLM                                        |
| success                        | boolean         | -                                                                                      |

- Response 200
  ```json
  {
    "success": true,
    "categories": [
      {
        "primaryLabel": "User Interface",
        "associatedLabels": ["UI", "User Experience", "Look", "Display", "Navigation"],
        "feedbackCount": 450
      },
      {
        "primaryLabel": "Integrations",
        "associatedLabels": ["Jira", "GitHub", "Workflow", "Webhook", "GitLab"],
        "feedbackCount": 300
      },
      {
        "primaryLabel": "Navigation",
        "associatedLabels": ["Discoverability", "Sidebar", "Selection"],
        "feedbackCount": 150
      }
    ],
    "numFeedbacksContext": 400
  }
  ```
