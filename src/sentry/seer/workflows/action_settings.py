from typing import Any, Literal

from pydantic import BaseModel, StrictStr, root_validator


class InvestigationSettings(BaseModel):
    mode: Literal["metric", "prompted"] = "metric"
    prompt: StrictStr = ""

    class Config:
        extra = "forbid"

    @root_validator
    def validate_prompt(cls, values: dict[str, Any]) -> dict[str, Any]:
        mode, prompt = values.get("mode"), values.get("prompt", "")
        if mode == "prompted" and not prompt.strip():
            raise ValueError("Prompted investigations require a prompt")
        if mode == "metric" and prompt:
            raise ValueError("Metric investigations use the detector's evidence, without a prompt")
        return values

    @classmethod
    def json_schema(cls) -> dict[str, Any]:
        schema = cls.schema()
        schema["allOf"] = [
            {
                "if": {"properties": {"mode": {"const": "prompted"}}, "required": ["mode"]},
                "then": {"required": ["prompt"], "properties": {"prompt": {"pattern": r"\S"}}},
                "else": {"properties": {"prompt": {"const": ""}}},
            }
        ]
        return schema
