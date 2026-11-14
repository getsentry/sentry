from drf_spectacular.utils import OpenApiExample

BLOCK: dict[str, object] = {
    "id": "12",
    "position": 0,
    "kind": "text",
    "title": "Summary",
    "content": "Checkout latency rose after the 2.4.0 release.",
    "generationPrompt": "",
    "generatedContent": "Checkout latency rose after the 2.4.0 release.",
    "output": {
        "schemaVersion": 1,
        "markdown": "Checkout latency rose after the 2.4.0 release.",
    },
    "outputStatus": "available",
    "currentExecution": {
        "id": "40",
        "status": "completed",
        "executor": "code_mode",
        "schemaVersion": 1,
        "startedAt": "2026-11-10T18:00:00.000000Z",
        "completedAt": "2026-11-10T18:00:00.000000Z",
        "error": None,
    },
    "config": {},
    "display": {"type": "markdown"},
    "dependencies": [],
    "parameterKeys": [],
    "version": 1,
    "staleAt": None,
    "createdBy": None,
    "lastEditedBy": None,
    "producerKey": "summary",
    "producerRevision": 1,
}

NOTEBOOK: dict[str, object] = {
    "id": "7",
    "title": "Checkout latency",
    "summary": None,
    "summaryDescription": None,
    "status": "active",
    "sourceType": "manual",
    "createdBy": "1",
    "creator": {"type": "user", "id": "1"},
    "dateCreated": "2026-11-10T17:55:00.000000Z",
    "dateUpdated": "2026-11-10T18:00:00.000000Z",
    "version": 2,
    "blockCount": 1,
    "isFavorited": False,
    "titleGeneration": {"status": None},
    "orchestration": None,
    "template": None,
    "source": {"type": "manual", "ref": {}, "revision": None},
    "filters": {},
    "projectIds": [1],
    "parameters": [],
    "blocks": [BLOCK],
    "actionRequests": [],
}


class NotebookExamples:
    NOTEBOOK_DETAILS = [
        OpenApiExample("Notebook details", value=NOTEBOOK, status_codes=["200"], response_only=True)
    ]
    CREATE_NOTEBOOK = [
        OpenApiExample(
            "Created notebook",
            value={**NOTEBOOK, "version": 1, "blockCount": 0, "blocks": []},
            status_codes=["201"],
            response_only=True,
        ),
        OpenApiExample(
            "Existing notebook for the source",
            value=NOTEBOOK,
            status_codes=["200"],
            response_only=True,
        ),
    ]
    BLOCK_DETAILS = [OpenApiExample("Block", value=BLOCK, status_codes=["200"], response_only=True)]
    CREATE_BLOCK = [
        OpenApiExample("Created block", value=BLOCK, status_codes=["201"], response_only=True),
        OpenApiExample("Updated block", value=BLOCK, status_codes=["200"], response_only=True),
    ]
