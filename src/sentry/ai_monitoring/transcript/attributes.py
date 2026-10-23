"""Structured evaluation and memory attributes used by the transcript port.

These mirror the parsing (not the presentation) in evaluation.ts and memory.ts.
Unknown entries remain available as raw values instead of being discarded.
"""

import json  # noqa: S003
import math
from collections.abc import Mapping
from typing import Any


def _number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _string_map(value: Any) -> bool:
    return isinstance(value, dict) and all(isinstance(item, str) for item in value.values())


def _number_map(value: Any) -> bool:
    return isinstance(value, dict) and all(_number(item) for item in value.values())


def _option(value: Any) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, bool):
        return "true" if value else "false"
    return None


def _question(value: Any) -> dict[str, Any]:
    invalid = {"kind": "invalid", "value": value}
    if not isinstance(value, dict) or not isinstance(value.get("type"), str):
        return invalid
    result = {"type": value["type"], "kind": "question"}
    if "instructions" in value:
        if not isinstance(value["instructions"], str):
            return invalid
        result["instructions"] = value["instructions"]
    if "criteria" in value:
        criteria = value["criteria"]
        if isinstance(criteria, list) and all(_option(item) is not None for item in criteria):
            result["criteria"] = [_option(item) for item in criteria]
        elif _string_map(criteria):
            result["criteria"] = criteria
        else:
            return invalid
    if "descriptions" in value:
        if not _string_map(value["descriptions"]):
            return invalid
        result["descriptions"] = value["descriptions"]
    return result


def _answer(value: Any) -> dict[str, Any]:
    invalid = {"kind": "invalid", "value": value}
    if not isinstance(value, dict):
        return invalid
    kind = value.get("type")
    if kind == "refusal":
        return {"kind": "refusal"}
    if kind in ("boolean", "predicate", "noul"):
        probability = value.get("noul" if kind == "noul" else "probability")
        return {"kind": "boolean", "probability": probability} if _number(probability) else invalid
    if kind == "score" and _number(value.get("score")):
        result = {"kind": "score", "score": value["score"]}
    elif kind == "choice" and _option(value.get("choice")) is not None:
        result = {"kind": "choice", "choice": _option(value["choice"])}
    else:
        return invalid
    for key, validator in (
        ("probabilities", _number_map),
        ("confidence", _number),
        ("legend", _string_map),
    ):
        if key == "legend" and kind != "score":
            continue
        if key in value:
            if not validator(value[key]):
                return invalid
            result[key] = value[key]
    return result


def _state(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        return [{"parts": [{"kind": "text", "text": value}]}]
    if isinstance(value, list) and value:
        messages = []
        for message in value:
            if not isinstance(message, dict) or (
                "role" in message and not isinstance(message["role"], str)
            ):
                break
            content = message.get("content")
            if isinstance(content, str):
                parts = [{"kind": "text", "text": content}]
            elif isinstance(content, list):
                parts = []
                valid = True
                for part in content:
                    if not isinstance(part, dict):
                        valid = False
                        break
                    if part.get("type") == "input_text" and isinstance(part.get("text"), str):
                        parts.append({"kind": "text", "text": part["text"]})
                    elif part.get("type") == "input_image":
                        parts.append({"kind": "image"})
                    else:
                        valid = False
                        break
                if not valid:
                    break
            else:
                break
            messages.append(
                {**({"role": message["role"]} if "role" in message else {}), "parts": parts}
            )
        else:
            return messages
    return [{"parts": [{"kind": "raw", "value": value}]}]


def _evaluation_items(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, str):
        return []
    try:
        parsed = json.loads(raw)
    except (ValueError, RecursionError):
        return []
    items = parsed if isinstance(parsed, list) else [parsed]
    return [item for item in items if isinstance(item, dict) and item.get("type") == "evaluation"]


def parse_evaluation_input(raw: Any) -> dict[str, Any] | None:
    for item in _evaluation_items(raw):
        if "state" not in item:
            continue
        result: dict[str, Any] = {"state": _state(item["state"]), "questions": []}
        if "questions" not in item:
            return result
        questions = item["questions"]
        if isinstance(questions, dict):
            result["questions"] = [
                {"key": key, **_question(value)} for key, value in questions.items()
            ]
        else:
            result["invalidQuestions"] = {"value": questions}
        return result
    return None


def parse_evaluation_output(raw: Any) -> list[dict[str, Any]] | None:
    for item in _evaluation_items(raw):
        answers = item.get("answers")
        if isinstance(answers, dict):
            return [{"key": key, **_answer(value)} for key, value in answers.items()]
    return None


def get_evaluation(attributes: Mapping[str, Any]) -> dict[str, Any] | None:
    if attributes.get("gen_ai.operation.name") not in ("evaluate", "decide"):
        return None
    raw_input, raw_output = (
        attributes.get("gen_ai.input.messages"),
        attributes.get("gen_ai.output.messages"),
    )
    return {
        "input": parse_evaluation_input(raw_input),
        "answers": parse_evaluation_output(raw_output),
        **({"rawInput": raw_input} if isinstance(raw_input, str) else {}),
        **({"rawOutput": raw_output} if isinstance(raw_output, str) else {}),
    }


def _memory_records(raw: str | None) -> list[dict[str, Any]] | None:
    if raw is None:
        return None
    try:
        parsed = json.loads(raw)
    except (ValueError, RecursionError):
        return None
    items = parsed if isinstance(parsed, list) else [parsed]
    records = []
    for item in items:
        if (
            isinstance(item, dict)
            and "content" in item
            and ("id" not in item or isinstance(item["id"], str))
            and ("score" not in item or _number(item["score"]))
        ):
            records.append(
                {
                    key: value
                    for key, value in item.items()
                    if key in ("content", "id", "metadata", "score")
                }
            )
        else:
            records.append({"content": item})
    return records


MEMORY_OPERATIONS = {
    "search_memory",
    "create_memory",
    "upsert_memory",
    "update_memory",
    "delete_memory",
    "create_memory_store",
    "delete_memory_store",
}


def is_memory_operation(operation: str | None) -> bool:
    return operation in MEMORY_OPERATIONS


def get_memory(attributes: Mapping[str, Any]) -> dict[str, Any] | None:
    if not is_memory_operation(attributes.get("gen_ai.operation.name")):
        return None
    result = {
        target: attributes[source]
        for target, source in (
            ("operation", "gen_ai.operation.name"),
            ("query", "gen_ai.memory.query.text"),
            ("recordId", "gen_ai.memory.record.id"),
            ("storeId", "gen_ai.memory.store.id"),
            ("rawRecords", "gen_ai.memory.records"),
        )
        if isinstance(attributes.get(source), str)
    }
    result["records"] = _memory_records(result.get("rawRecords"))
    raw_count = attributes.get("gen_ai.memory.record.count")
    if raw_count is not None and raw_count != "" and not isinstance(raw_count, bool):
        try:
            count = (
                float(raw_count.strip() or "0") if isinstance(raw_count, str) else float(raw_count)
            )
        except (ValueError, TypeError):
            pass
        else:
            if math.isfinite(count):
                result["recordCount"] = count
    return result
