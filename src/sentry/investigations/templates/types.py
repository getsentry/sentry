from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class TemplateParameterSpec:
    key: str
    label: str
    type: str
    description: str = ""
    required: bool = False
    default_value: Any = None
    constraints: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class TemplateBlockSpec:
    key: str
    kind: str
    title: str
    content: str = ""
    generation_prompt: str = ""
    generated_content: str = ""
    config: dict[str, Any] = field(default_factory=dict)
    display: dict[str, Any] = field(default_factory=dict)
    dependencies: tuple[str, ...] = ()
    parameters: tuple[str, ...] = ()


@dataclass(frozen=True)
class InvestigationTemplateSpec:
    key: str
    version: int
    source_type: str
    parameters: tuple[TemplateParameterSpec, ...]
    blocks: tuple[TemplateBlockSpec, ...]
