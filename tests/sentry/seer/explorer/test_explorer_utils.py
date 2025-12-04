from typing import Any

from sentry.seer.explorer.utils import convert_profile_to_execution_tree, normalize_description


class TestNormalizeDescription:
    """Test cases for the normalize_description utility function."""

    def test_normalize_description_basic(self) -> None:
        """Test basic functionality without any special patterns."""
        result = normalize_description("simple description")
        assert result == "simple description"

    def test_normalize_description_empty_string(self) -> None:
        """Test with empty string."""
        result = normalize_description("")
        assert result == ""

    def test_normalize_description_uuid_with_dashes(self) -> None:
        """Test UUID normalization with dashes."""
        result = normalize_description(
            "GET /api/users/123e4567-e89b-12d3-a456-426614174000/profile"
        )
        assert result == "GET /api/users/<UUID>/profile"

    def test_normalize_description_uuid_without_dashes(self) -> None:
        """Test UUID normalization without dashes."""
        result = normalize_description("Query 123e4567e89b12d3a456426614174000 from cache")
        assert result == "Query <UUID> from cache"

    def test_normalize_description_multiple_uuids(self) -> None:
        """Test with multiple UUIDs."""
        result = normalize_description(
            "Transfer 123e4567-e89b-12d3-a456-426614174000 to 987fcdeb-51a2-43d7-8965-123456789abc"
        )
        assert result == "Transfer <UUID> to <UUID>"

    def test_normalize_description_long_numbers(self) -> None:
        """Test long numeric sequence normalization."""
        result = normalize_description("Process transaction 1234567890 with amount 999999")
        assert result == "Process transaction <NUM> with amount <NUM>"

    def test_normalize_description_short_numbers_preserved(self) -> None:
        """Test that short numbers are preserved."""
        result = normalize_description("GET /api/v1/users/123")
        assert result == "GET /api/v1/users/123"

    def test_normalize_description_hex_strings_with_0x_prefix(self) -> None:
        """Test hex string normalization with 0x prefix."""
        result = normalize_description("Memory address 0x1a2b3c4d5e6f7890 allocated")
        assert result == "Memory address 0x<HEX> allocated"

    def test_normalize_description_hex_strings_without_prefix(self) -> None:
        """Test hex string normalization without prefix."""
        result = normalize_description("Hash abcdef123456789 calculated")
        assert result == "Hash <HEX> calculated"

    def test_normalize_description_short_hex_preserved(self) -> None:
        """Test that short hex strings are preserved."""
        result = normalize_description("Color #ff0000 used")
        assert result == "Color #ff0000 used"

    def test_normalize_description_timestamps(self) -> None:
        """Test timestamp normalization."""
        result = normalize_description("Event at 2023-12-25T10:30:45 was processed")
        assert result == "Event at <TIMESTAMP> was processed"

    def test_normalize_description_timestamp_with_space(self) -> None:
        """Test timestamp with space separator."""
        result = normalize_description("Log entry 2023-12-25 10:30:45 created")
        assert result == "Log entry <TIMESTAMP> created"

    def test_normalize_description_whitespace_cleanup(self) -> None:
        """Test whitespace cleanup."""
        result = normalize_description("  Multiple   spaces    here  ")
        assert result == "Multiple spaces here"

    def test_normalize_description_complex_combination(self) -> None:
        """Test complex case with multiple patterns."""
        result = normalize_description(
            "Process  123e4567-e89b-12d3-a456-426614174000  at  2023-12-25T10:30:45  "
            "with  ID  1234567890  and  hash  0xabcdef123456789"
        )
        assert result == "Process <UUID> at <TIMESTAMP> with ID <NUM> and hash 0x<HEX>"

    def test_normalize_description_sql_query(self) -> None:
        """Test with SQL query containing IDs."""
        result = normalize_description(
            "SELECT * FROM users WHERE id = 1234567890 AND uuid = '123e4567-e89b-12d3-a456-426614174000'"
        )
        assert result == "SELECT * FROM users WHERE id = <NUM> AND uuid = '<UUID>'"

    def test_normalize_description_api_path(self) -> None:
        """Test with API path containing various IDs."""
        result = normalize_description(
            "POST /api/v2/organizations/1234567/projects/123e4567-e89b-12d3-a456-426614174000/events"
        )
        assert result == "POST /api/v2/organizations/<NUM>/projects/<UUID>/events"


class TestConvertProfileToExecutionTree:
    """Test cases for the convert_profile_to_execution_tree utility function."""

    def test_convert_profile_empty_input(self) -> None:
        """Test with empty profile data."""
        result = convert_profile_to_execution_tree({})
        assert result == []

    def test_convert_profile_no_profile_key(self) -> None:
        """Test with missing profile key."""
        result = convert_profile_to_execution_tree({"other": "data"})
        assert result == []

    def test_convert_profile_missing_required_fields(self) -> None:
        """Test with missing required fields in profile."""
        profile_data: dict[str, Any] = {"profile": {"frames": []}}
        result = convert_profile_to_execution_tree(profile_data)
        assert result == []

        profile_data = {"profile": {"frames": [], "stacks": []}}
        result = convert_profile_to_execution_tree(profile_data)
        assert result == []

    def test_convert_profile_empty_profile_data(self) -> None:
        """Test with empty but valid profile structure."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [],
                "stacks": [],
                "samples": [],
                "thread_metadata": {},
            }
        }
        result = convert_profile_to_execution_tree(profile_data)
        assert result == []

    def test_convert_profile_single_frame_single_sample(self) -> None:
        """Test with minimal valid profile data."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],  # Stack with frame index 0
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "1",
                        "stack_id": 0,
                    }
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1

        root = result[0]
        assert root.function == "main"
        assert root.module == "app"
        assert root.filename == "main.py"
        assert root.lineno == 10
        assert root.in_app is True
        assert root.sample_count == 1
        assert root.first_seen_ns == 1000000
        assert root.last_seen_ns == 1000000
        assert root.children == []
        assert root.node_id is not None

    def test_convert_profile_nested_call_stack(self) -> None:
        """Test with nested call stack."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "process_data",
                        "module": "app.utils",
                        "filename": "utils.py",
                        "lineno": 25,
                        "in_app": True,
                    },
                    {
                        "function": "validate_input",
                        "module": "app.validators",
                        "filename": "validators.py",
                        "lineno": 15,
                        "in_app": True,
                    },
                ],
                "stacks": [[0, 1, 2]],  # All frames in one stack
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "1",
                        "stack_id": 0,
                    }
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1

        root = result[0]
        assert root.function == "validate_input"
        assert len(root.children) == 1

        child1 = root.children[0]
        assert child1.function == "process_data"
        assert len(child1.children) == 1

        child2 = child1.children[0]
        assert child2.function == "main"
        assert len(child2.children) == 0

    def test_convert_profile_multiple_samples_duration_calculation(self) -> None:
        """Test duration calculation with multiple samples."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "1",
                        "stack_id": 0,
                    },
                    {
                        "elapsed_since_start_ns": 2000000,
                        "thread_id": "1",
                        "stack_id": 0,
                    },
                    {
                        "elapsed_since_start_ns": 3000000,
                        "thread_id": "1",
                        "stack_id": 0,
                    },
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1

        root = result[0]
        assert root.sample_count == 3
        assert root.first_seen_ns == 1000000
        assert root.last_seen_ns == 3000000
        assert root.duration_ns is not None
        assert root.duration_ns > 0

    def test_convert_profile_filters_non_app_frames(self) -> None:
        """Test that non-app frames are filtered out."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "app_function",
                        "module": "app",
                        "filename": "app.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "stdlib_function",
                        "module": "stdlib",
                        "filename": "/usr/lib/python/stdlib.py",
                        "lineno": 100,
                        "in_app": False,
                    },
                    {
                        "function": "another_app_function",
                        "module": "app",
                        "filename": "app.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                ],
                "stacks": [[0, 1, 2]],  # Mixed app and non-app frames
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "1",
                        "stack_id": 0,
                    }
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1

        # Should only have app frames, stdlib_function should be filtered out
        root = result[0]
        assert root.function == "another_app_function"
        assert len(root.children) == 1
        assert root.children[0].function == "app_function"

    def test_convert_profile_filters_generated_frames(self) -> None:
        """Test that generated frames (with <filename>) are filtered out."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "app_function",
                        "module": "app",
                        "filename": "app.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "generated_function",
                        "module": "generated",
                        "filename": "<generated>",
                        "lineno": 1,
                        "in_app": True,  # Even though in_app=True, should be filtered
                    },
                ],
                "stacks": [[0, 1]],
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "1",
                        "stack_id": 0,
                    }
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1

        # Should only have the app function, generated function should be filtered
        root = result[0]
        assert root.function == "app_function"
        assert len(root.children) == 0

    def test_convert_profile_single_thread_fallback(self) -> None:
        """Test fallback to first sample's thread when no MainThread is found."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    }
                ],
                "stacks": [[0]],
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "worker1",
                        "stack_id": 0,
                    }
                ],
                "thread_metadata": {"worker1": {"name": "WorkerThread"}},  # No MainThread
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1
        assert result[0].function == "main"

    def test_convert_profile_ignores_other_threads(self) -> None:
        """Test that samples from other threads are ignored."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "main_function",
                        "module": "app",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "worker_function",
                        "module": "app",
                        "filename": "worker.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                ],
                "stacks": [[0], [1]],
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "1",  # MainThread
                        "stack_id": 0,
                    },
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "2",  # Other thread - should be ignored
                        "stack_id": 1,
                    },
                ],
                "thread_metadata": {
                    "1": {"name": "MainThread"},
                    "2": {"name": "WorkerThread"},
                },
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1

        # Should only contain the main function from MainThread (selected because it has in_app frames)
        root = result[0]
        assert root.function == "main_function"

    def test_convert_profile_complex_call_patterns(self) -> None:
        """Test complex call patterns with function entries and exits."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "main",
                        "module": "app",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "helper_a",
                        "module": "app",
                        "filename": "helpers.py",
                        "lineno": 15,
                        "in_app": True,
                    },
                    {
                        "function": "helper_b",
                        "module": "app",
                        "filename": "helpers.py",
                        "lineno": 25,
                        "in_app": True,
                    },
                ],
                "stacks": [
                    [0],  # main only
                    [0, 1],  # main -> helper_a
                    [0, 1, 2],  # main -> helper_a -> helper_b
                    [0, 1],  # main -> helper_a (helper_b returned)
                    [0],  # main only (helper_a returned)
                ],
                "samples": [
                    {"elapsed_since_start_ns": 1000000, "thread_id": "1", "stack_id": 0},
                    {"elapsed_since_start_ns": 2000000, "thread_id": "1", "stack_id": 1},
                    {"elapsed_since_start_ns": 3000000, "thread_id": "1", "stack_id": 2},
                    {"elapsed_since_start_ns": 4000000, "thread_id": "1", "stack_id": 3},
                    {"elapsed_since_start_ns": 5000000, "thread_id": "1", "stack_id": 4},
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        # Each unique deepest function becomes a root, so we get 3 roots:
        # main (from samples 1 and 5), helper_a (from samples 2 and 4), helper_b (from sample 3)
        assert len(result) == 3

        # Find functions by name
        roots_by_function = {node.function: node for node in result}

        main_root = roots_by_function["main"]
        assert main_root.sample_count == 2  # Present in samples 1 and 5

        helper_a_root = roots_by_function["helper_a"]
        assert helper_a_root.sample_count == 2  # Present in samples 2 and 4
        assert len(helper_a_root.children) == 1
        assert helper_a_root.children[0].function == "main"

        helper_b_root = roots_by_function["helper_b"]
        assert helper_b_root.sample_count == 1  # Present in sample 3
        assert len(helper_b_root.children) == 1
        assert helper_b_root.children[0].function == "helper_a"

    def test_convert_profile_duration_calculation_accuracy(self) -> None:
        """Test that duration calculations are reasonable."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "short_function",
                        "module": "app",
                        "filename": "app.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "long_function",
                        "module": "app",
                        "filename": "app.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                ],
                "stacks": [
                    [0],  # short_function
                    [1],  # long_function starts
                    [1],  # long_function continues
                    [1],  # long_function continues
                ],
                "samples": [
                    {"elapsed_since_start_ns": 1000000, "thread_id": "1", "stack_id": 0},
                    {"elapsed_since_start_ns": 2000000, "thread_id": "1", "stack_id": 1},
                    {"elapsed_since_start_ns": 3000000, "thread_id": "1", "stack_id": 2},
                    {"elapsed_since_start_ns": 4000000, "thread_id": "1", "stack_id": 3},
                ],
                "thread_metadata": {"1": {"name": "MainThread"}},
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 2

        # Find functions by name
        short_func = next(node for node in result if node.function == "short_function")
        long_func = next(node for node in result if node.function == "long_function")

        # long_function should have longer duration than short_function
        assert short_func.duration_ns is not None
        assert long_func.duration_ns is not None
        assert long_func.duration_ns > short_func.duration_ns

        # Verify sample counts
        assert short_func.sample_count == 1
        assert long_func.sample_count == 3

    def test_convert_profile_selects_thread_with_most_in_app_frames(self) -> None:
        """Test that the thread with the most in_app frames is selected."""
        profile_data: dict[str, Any] = {
            "profile": {
                "frames": [
                    {
                        "function": "main_function",
                        "module": "app",
                        "filename": "main.py",
                        "lineno": 10,
                        "in_app": True,
                    },
                    {
                        "function": "worker_function_1",
                        "module": "app",
                        "filename": "worker.py",
                        "lineno": 20,
                        "in_app": True,
                    },
                    {
                        "function": "worker_function_2",
                        "module": "app",
                        "filename": "worker.py",
                        "lineno": 30,
                        "in_app": True,
                    },
                    {
                        "function": "worker_function_3",
                        "module": "app",
                        "filename": "worker.py",
                        "lineno": 40,
                        "in_app": True,
                    },
                ],
                "stacks": [[0], [1, 2, 3]],  # MainThread has 1 frame, WorkerThread has 3 frames
                "samples": [
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "1",  # MainThread - 1 in_app frame
                        "stack_id": 0,
                    },
                    {
                        "elapsed_since_start_ns": 1000000,
                        "thread_id": "2",  # WorkerThread - 3 in_app frames (should be selected)
                        "stack_id": 1,
                    },
                ],
                "thread_metadata": {
                    "1": {"name": "MainThread"},
                    "2": {"name": "WorkerThread"},
                },
            }
        }

        result = convert_profile_to_execution_tree(profile_data)
        assert len(result) == 1

        # Should contain worker_function_3 from WorkerThread (thread with most in_app frames)
        root = result[0]
        assert root.function == "worker_function_3"
        assert len(root.children) == 1
        assert root.children[0].function == "worker_function_2"
        assert len(root.children[0].children) == 1
        assert root.children[0].children[0].function == "worker_function_1"
