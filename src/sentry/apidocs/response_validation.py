from __future__ import annotations

import logging
import time
from collections.abc import Iterator
from typing import Any, Literal, Mapping

import orjson
from django.http import HttpRequest
from django.http.response import HttpResponseBase
from jsonschema import Draft4Validator, FormatChecker, ValidationError
from jsonschema.protocols import Validator
from jsonschema.validators import extend
from rest_framework.response import Response

from sentry import options
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.apidocs.response_contracts import (
    OperationContract,
    get_runtime_operation_contract,
    normalize_django_route,
)
from sentry.options.rollout import in_random_rollout
from sentry.utils import metrics

logger = logging.getLogger(__name__)

ValidationOutcome = Literal[
    "additive",
    "breaking",
    "candidate",
    "internal_error",
    "skipped",
    "valid",
]


class _UndocumentedPropertiesError(ValidationError):
    pass


def _oas30_type(
    validator: Validator,
    expected_type: Any,
    instance: Any,
    schema: Mapping[str, Any],
) -> Iterator[ValidationError]:
    if instance is None and schema.get("nullable") is True:
        return
    yield from Draft4Validator.VALIDATORS["type"](validator, expected_type, instance, schema)


def _response_required(
    validator: Validator,
    required: list[str],
    instance: Any,
    schema: Mapping[str, Any],
) -> Iterator[ValidationError]:
    properties = schema.get("properties", {})
    response_fields = [
        name for name in required if not properties.get(name, {}).get("writeOnly", False)
    ]
    yield from Draft4Validator.VALIDATORS["required"](validator, response_fields, instance, schema)


def _reject_write_only(
    _validator: Validator,
    write_only: bool,
    _instance: Any,
    _schema: Mapping[str, Any],
) -> Iterator[ValidationError]:
    if write_only:
        yield ValidationError("Response contains a write-only property")


def _strict_properties(
    validator: Validator,
    properties: Mapping[str, Any],
    instance: Any,
    schema: Mapping[str, Any],
) -> Iterator[ValidationError]:
    base_properties = Draft4Validator.VALIDATORS["properties"]
    yield from base_properties(validator, properties, instance, schema)

    if not isinstance(instance, dict) or "additionalProperties" in schema:
        return

    extra_count = len(instance.keys() - properties.keys())
    if extra_count:
        yield _UndocumentedPropertiesError(
            f"Response contains {extra_count} undocumented properties"
        )


_ResponseValidator = extend(
    Draft4Validator,
    validators={
        "properties": _strict_properties,
        "required": _response_required,
        "type": _oas30_type,
        "writeOnly": _reject_write_only,
    },
)
_FORMAT_CHECKER = FormatChecker()


def _record_outcome(
    status_code: int,
    outcome: ValidationOutcome,
    *,
    reason: str | None = None,
) -> None:
    tags = {
        "outcome": outcome,
        "status": str(status_code),
    }
    if reason is not None:
        tags["reason"] = reason
    metrics.incr(
        "api.response_schema_validation",
        tags=tags,
        sample_rate=1.0,
    )


def _schema_path(error: ValidationError) -> str:
    return "/".join(str(component) for component in error.absolute_schema_path) or "root"


def _log_violation(
    *,
    operation_id: str,
    owner: str,
    status_code: int,
    category: Literal["additive", "breaking"],
    validator: str,
    schema_path: str,
) -> None:
    logger.warning(
        "api.response_schema_validation.violation",
        extra={
            "api_owner": owner,
            "api_operation": operation_id,
            "contract_violation": category,
            "status_code": status_code,
            "validator": validator,
            "schema_path": schema_path,
        },
    )


def _validate_rendered_response(
    response: Response,
    *,
    contract: OperationContract,
    owner: str,
    schema: dict[str, Any],
    max_response_bytes: int,
) -> None:
    status_code = response.status_code
    started = time.monotonic()

    try:
        response_size = len(response.content)
        metrics.distribution(
            "api.response_schema_validation.response_size",
            response_size,
            sample_rate=1.0,
            unit="byte",
        )
        if response_size > max_response_bytes:
            _record_outcome(status_code, "skipped", reason="response_too_large")
            return

        content_type = response.get("Content-Type", "").partition(";")[0]
        if content_type != "application/json":
            _record_outcome(status_code, "breaking", reason="content_type")
            _log_violation(
                operation_id=contract["operation_id"],
                owner=owner,
                status_code=status_code,
                category="breaking",
                validator="content_type",
                schema_path="root",
            )
            return

        validator = _ResponseValidator(schema, format_checker=_FORMAT_CHECKER)
        additive_error: ValidationError | None = None
        breaking_error: ValidationError | None = None
        for error in validator.iter_errors(orjson.loads(response.content)):
            if isinstance(error, _UndocumentedPropertiesError):
                if additive_error is None:
                    additive_error = error
            else:
                breaking_error = error
                break

        if breaking_error is not None:
            _record_outcome(status_code, "breaking", reason="schema")
            _log_violation(
                operation_id=contract["operation_id"],
                owner=owner,
                status_code=status_code,
                category="breaking",
                validator=str(breaking_error.validator or "schema"),
                schema_path=_schema_path(breaking_error),
            )
        elif additive_error is not None:
            _record_outcome(status_code, "additive", reason="schema")
            _log_violation(
                operation_id=contract["operation_id"],
                owner=owner,
                status_code=status_code,
                category="additive",
                validator="additionalProperties",
                schema_path=_schema_path(additive_error),
            )
        else:
            _record_outcome(status_code, "valid")
    except Exception:
        _record_outcome(status_code, "internal_error", reason="validator")
        logger.exception(
            "api.response_schema_validation.failed",
            extra={"operation": contract["operation_id"]},
        )
    finally:
        metrics.distribution(
            "api.response_schema_validation.duration",
            (time.monotonic() - started) * 1000,
            sample_rate=1.0,
            unit="millisecond",
        )


def maybe_validate_response_contract(
    request: HttpRequest,
    response: HttpResponseBase,
) -> None:
    """Attach sampled response validation without affecting the returned response."""
    try:
        if not isinstance(response, Response) or not 200 <= response.status_code < 300:
            return
        resolver_match = request.resolver_match
        if resolver_match is None or request.method is None:
            return
        callback = resolver_match.func
        endpoint_class = getattr(callback, "cls", None)
        if (
            endpoint_class is None
            or endpoint_class.publish_status.get(request.method) is not ApiPublishStatus.PUBLIC
        ):
            return
        owner = endpoint_class.owner.value
        if options.get("api.response-schema-validation.rollout-rate") <= 0:
            return
        if not in_random_rollout("api.response-schema-validation.rollout-rate"):
            return

        normalized_route = normalize_django_route(resolver_match.route)
        status_code = response.status_code
        contract = get_runtime_operation_contract(
            callback,
            normalized_route,
            resolver_match.route,
            request.method,
        )
        if contract is None:
            return
        if contract["operation_id"] in options.get(
            "api.response-schema-validation.excluded-operations"
        ):
            return

        _record_outcome(status_code, "candidate")
        if str(status_code) not in contract["responses"]:
            _record_outcome(status_code, "breaking", reason="undocumented_status")
            _log_violation(
                operation_id=contract["operation_id"],
                owner=owner,
                status_code=status_code,
                category="breaking",
                validator="status",
                schema_path="responses",
            )
            return

        schema = contract["responses"][str(status_code)]
        if schema is None:
            _record_outcome(status_code, "skipped", reason="no_json_schema")
            return

        max_response_bytes = options.get("api.response-schema-validation.max-response-bytes")
        if max_response_bytes <= 0:
            _record_outcome(status_code, "skipped", reason="invalid_max_response_bytes")
            return
        response.add_post_render_callback(
            lambda rendered_response: _validate_rendered_response(
                rendered_response,
                contract=contract,
                owner=owner,
                schema=schema,
                max_response_bytes=max_response_bytes,
            )
        )
    except Exception:
        metrics.incr(
            "api.response_schema_validation",
            tags={"outcome": "internal_error", "reason": "setup"},
            sample_rate=1.0,
        )
        logger.exception("api.response_schema_validation.setup_failed")
