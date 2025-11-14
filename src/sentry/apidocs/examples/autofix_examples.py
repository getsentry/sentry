from typing import int
from drf_spectacular.utils import OpenApiExample

AUTOFIX_POST_RESPONSE = [
    OpenApiExample(
        name="Successful Autofix Creation",
        value={"run_id": 12345},
        response_only=True,
        status_codes=["202"],
    ),
]

AUTOFIX_GET_RESPONSE = [
    OpenApiExample(
        name="Autofix in Progress",
        value={
            "autofix": {
                "run_id": 12345,
                "request": {
                    "organization_id": 1,
                    "project_id": 2,
                    "repos": [
                        {
                            "integration_id": "12345",
                            "provider": "github",
                            "owner": "getsentry",
                            "name": "seer",
                            "external_id": "439438299",
                            "branch_name": "main",
                            "base_commit_sha": "4ebb4f342e308fda87d6ccb3cced25f2701bd60c",
                        },
                    ],
                    "tags_overview": {
                        "tags_overview": [
                            {
                                "key": "environment",
                                "name": "Environment",
                                "top_values": [
                                    {"count": 1, "percentage": "100%", "value": "production"}
                                ],
                            },
                            {
                                "key": "run_id",
                                "name": "Run Id",
                                "top_values": [
                                    {"count": 1, "percentage": "100%", "value": "1372444"}
                                ],
                            },
                        ]
                    },
                    "options": {
                        "auto_run_source": "issue_summary_on_alert_fixability",
                    },
                },
                "updated_at": "2025-09-23T21:02:18.160885",
                "status": "COMPLETED",
                "codebases": {
                    "439438299": {
                        "repo_external_id": "439438299",
                        "file_changes": [],
                        "is_readable": True,
                        "is_writeable": True,
                    },
                },
                "steps": [
                    {
                        "active_comment_thread": None,
                        "agent_comment_thread": None,
                        "completedMessage": None,
                        "id": "0872381c-7d71-46cd-a62b-fbc196846965",
                        "index": 0,
                        "initial_memory_length": 1,
                        "insights": [],
                        "key": "root_cause_analysis_processing",
                        "output_confidence_score": None,
                        "output_stream": None,
                        "proceed_confidence_score": None,
                        "progress": [
                            {
                                "data": None,
                                "message": "Figuring out the root cause...",
                                "timestamp": "2025-09-12T23:20:31.304114",
                                "type": "INFO",
                            },
                            {
                                "data": None,
                                "message": "Looking at `src/seer/automation/autofix/tools/tools.py` in `getsentry/seer`...",
                                "timestamp": "2025-09-12T23:20:49.671212",
                                "type": "INFO",
                            },
                            {
                                "data": None,
                                "message": "Simulating profound thought...",
                                "timestamp": "2025-09-12T23:20:58.229135",
                                "type": "INFO",
                            },
                            {
                                "data": None,
                                "message": "Arranging data in a way that looks intentional...",
                                "timestamp": "2025-09-12T23:21:22.696531",
                                "type": "INFO",
                            },
                        ],
                        "queued_user_messages": [],
                        "status": "COMPLETED",
                        "title": "Analyzing the Issue",
                        "type": "default",
                    },
                    {
                        "active_comment_thread": None,
                        "agent_comment_thread": None,
                        "causes": [
                            {
                                "description": "`BaseTools.run_ripgrep` called without required `query` argument, causing `TypeError`.",
                                "id": 0,
                                "relevant_repos": ["getsentry/seer"],
                                "reproduction_urls": [],
                                "root_cause_reproduction": [
                                    {
                                        "code_snippet_and_analysis": "The process begins with an HTTP request to the `autofix_start_endpoint`. This is the entry point for the autofix workflow.",
                                        "is_most_important_event": False,
                                        "relevant_code_file": {
                                            "file_path": "seer/app.py",
                                            "repo_name": "getsentry/seer",
                                        },
                                        "timeline_item_type": "internal_code",
                                        "title": "Autofix process initiated via API endpoint.",
                                    },
                                ],
                            }
                        ],
                        "completedMessage": None,
                        "id": "e6ae64b6-e4d4-44f5-bac7-6ecf6780a6dc",
                        "index": 1,
                        "key": "root_cause_analysis",
                        "output_stream": None,
                        "progress": [
                            {
                                "data": None,
                                "message": "Here is Autofix's proposed root cause.",
                                "timestamp": "2025-09-12T23:21:30.662818",
                                "type": "INFO",
                            }
                        ],
                        "queued_user_messages": [],
                        "selection": {"cause_id": 0, "instruction": None},
                        "status": "COMPLETED",
                        "termination_reason": None,
                        "title": "Root Cause Analysis",
                        "type": "root_cause_analysis",
                    },
                ],
                "coding_agents": {},
                "last_triggered_at": "2025-09-23T21:00:46.696678",
                "completed_at": None,
                "repositories": [
                    {
                        "integration_id": 2933,
                        "url": "https://github.com/getsentry/seer",
                        "external_id": "439438299",
                        "name": "getsentry/seer",
                        "provider": "integrations:github",
                        "default_branch": "main",
                        "is_readable": True,
                        "is_writeable": True,
                    }
                ],
            }
        },
        response_only=True,
        status_codes=["200"],
    ),
]


class AutofixExamples:
    AUTOFIX_POST_RESPONSE = AUTOFIX_POST_RESPONSE
    AUTOFIX_GET_RESPONSE = AUTOFIX_GET_RESPONSE
