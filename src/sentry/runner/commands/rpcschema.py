import sys
import traceback
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

import click
from django.urls import reverse

from sentry.runner.decorators import configuration
from sentry.utils import json


@click.command()
@click.option(
    "--partial",
    is_flag=True,
    default=False,
    help="Ignore RPC methods that produce errors.",
)
@click.option(
    "--diagnose",
    is_flag=True,
    default=False,
    help="List RPC methods that produce errors and suppress all other output.",
)
@click.option(
    "--canned",
    is_flag=True,
    default=False,
    help="Produce canned output without interacting with Sentry code.",
)
@configuration
def rpcschema(canned: bool, diagnose: bool, partial: bool) -> None:
    if canned:
        json.dump(_CANNED_OUTPUT, sys.stdout)
        return

    from openapi_pydantic import OpenAPI
    from openapi_pydantic.util import PydanticSchema, construct_open_api_with_schema_class

    from sentry.services.hybrid_cloud.rpc import (
        RpcMethodSignature,
        list_all_service_method_signatures,
    )

    @dataclass
    class RpcSchemaEntry:
        sig: RpcMethodSignature

        @property
        def api_path(self) -> str:
            return reverse(
                "sentry-api-0-rpc-service", args=(self.sig.service_key, self.sig.method_name)
            )

        def build_api_entry(self) -> dict[str, Any]:
            param_schema, return_schema = self.sig.dump_schemas()
            return {
                "post": {
                    "description": "Execute an RPC",
                    "requestBody": {
                        "content": {
                            "application/json": {
                                "schema": PydanticSchema(schema_class=param_schema)
                            }
                        },
                    },
                    "responses": {
                        "200": {
                            "description": "Success",
                            "content": {
                                "application/json": {
                                    "schema": PydanticSchema(schema_class=return_schema)
                                }
                            },
                        }
                    },
                }
            }

    def create_spec(signatures: Iterable[RpcMethodSignature]) -> dict[str, Any]:
        entries = [RpcSchemaEntry(sig) for sig in signatures]
        path_dict = {entry.api_path: entry.build_api_entry() for entry in entries}

        spec = OpenAPI.parse_obj(
            dict(
                info=dict(
                    title="Sentry Internal RPC APIs",
                    version="0.0.1",
                ),
                servers=[dict(url="https://sentry.io/")],  # TODO: Generify with setting value
                paths=path_dict,
            )
        )
        spec = construct_open_api_with_schema_class(spec)
        return spec.dict(by_alias=True, exclude_none=True)

    def create_partial_spec(
        signatures: Iterable[RpcMethodSignature],
    ) -> tuple[dict[str, Any], list[str]]:
        stable_signatures: list[RpcMethodSignature] = []
        error_reports: list[str] = []
        for sig in signatures:
            try:
                create_spec([sig])
            except Exception as e:
                last_line = str(e).split("\n")[-1].strip()
                error_reports.append(f"{sig!s}: {last_line}")
                if not diagnose:
                    traceback.print_exc()
            else:
                stable_signatures.append(sig)

        return create_spec(stable_signatures), error_reports

    all_signatures = list_all_service_method_signatures()

    if diagnose or partial:
        spec, error_reports = create_partial_spec(all_signatures)
        if diagnose:
            print(f"Error count: {len(error_reports)}")  # noqa
            for bad_sig in error_reports:
                print("- " + bad_sig)  # noqa
    else:
        spec = create_spec(all_signatures)

    if not diagnose:
        json.dump(spec, sys.stdout)


_CANNED_OUTPUT = {
    "openapi": "3.1.0",
    "info": {"title": "Sentry Internal RPC APIs", "version": "0.0.1"},
    "servers": [{"url": "https://sentry.io/"}],
    "paths": {
        "/api/0/internal/rpc/organization/get_organization_by_id/": {
            "post": {
                "description": "Execute an RPC",
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "$ref": "#/components/schemas/OrganizationService__get_organization_by_id__ParameterModel"
                            }
                        }
                    },
                    "required": False,
                },
                "responses": {
                    "200": {
                        "description": "Success",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/OrganizationService__get_organization_by_id__ReturnModel"
                                }
                            }
                        },
                    }
                },
                "deprecated": False,
            }
        }
    },
    "components": {
        "schemas": {
            "OrganizationService__get_organization_by_id__ParameterModel": {
                "properties": {
                    "id": {"type": "integer", "title": "Id"},
                    "user_id": {"type": "integer", "title": "User Id"},
                    "slug": {"type": "integer", "title": "Slug"},
                    "include_projects": {
                        "type": "boolean",
                        "title": "Include Projects",
                        "default": True,
                    },
                    "include_teams": {"type": "boolean", "title": "Include Teams", "default": True},
                },
                "type": "object",
                "required": ["id"],
                "title": "OrganizationService__get_organization_by_id__ParameterModel",
            },
            "RpcTeam": {
                "properties": {
                    "id": {"type": "integer", "title": "Id", "default": -1},
                    "status": {"type": "integer", "title": "Status"},
                    "organization_id": {
                        "type": "integer",
                        "title": "Organization Id",
                        "default": -1,
                    },
                    "slug": {"type": "string", "title": "Slug", "default": ""},
                    "actor_id": {"type": "integer", "title": "Actor Id"},
                    "org_role": {"type": "string", "title": "Org Role"},
                    "name": {"type": "string", "title": "Name", "default": ""},
                },
                "type": "object",
                "title": "RpcTeam",
                "description": "A serializable object that may be part of an RPC schema.",
            },
            "RpcProject": {
                "properties": {
                    "id": {"type": "integer", "title": "Id", "default": -1},
                    "slug": {"type": "string", "title": "Slug", "default": ""},
                    "name": {"type": "string", "title": "Name", "default": ""},
                    "organization_id": {
                        "type": "integer",
                        "title": "Organization Id",
                        "default": -1,
                    },
                    "status": {"type": "integer", "title": "Status"},
                    "platform": {"type": "string", "title": "Platform"},
                },
                "type": "object",
                "title": "RpcProject",
                "description": "A serializable object that may be part of an RPC schema.",
            },
            "RpcOrganizationFlags": {
                "properties": {
                    "early_adopter": {
                        "type": "boolean",
                        "title": "Early Adopter",
                        "default": False,
                    },
                    "require_2fa": {"type": "boolean", "title": "Require 2Fa", "default": False},
                    "allow_joinleave": {
                        "type": "boolean",
                        "title": "Allow Joinleave",
                        "default": False,
                    },
                    "enhanced_privacy": {
                        "type": "boolean",
                        "title": "Enhanced Privacy",
                        "default": False,
                    },
                    "disable_shared_issues": {
                        "type": "boolean",
                        "title": "Disable Shared Issues",
                        "default": False,
                    },
                    "disable_new_visibility_features": {
                        "type": "boolean",
                        "title": "Disable New Visibility Features",
                        "default": False,
                    },
                    "require_email_verification": {
                        "type": "boolean",
                        "title": "Require Email Verification",
                        "default": False,
                    },
                    "codecov_access": {
                        "type": "boolean",
                        "title": "Codecov Access",
                        "default": False,
                    },
                },
                "type": "object",
                "title": "RpcOrganizationFlags",
                "description": "A serializable object that may be part of an RPC schema.",
            },
            "RpcOrganization": {
                "properties": {
                    "slug": {"type": "string", "title": "Slug", "default": ""},
                    "id": {"type": "integer", "title": "Id", "default": -1},
                    "name": {"type": "string", "title": "Name", "default": ""},
                    "teams": {
                        "items": {"$ref": "#/components/schemas/RpcTeam"},
                        "type": "array",
                        "title": "Teams",
                    },
                    "projects": {
                        "items": {"$ref": "#/components/schemas/RpcProject"},
                        "type": "array",
                        "title": "Projects",
                    },
                    "flags": {"$ref": "#/components/schemas/RpcOrganizationFlags"},
                    "status": {"type": "integer", "title": "Status"},
                    "default_role": {"type": "string", "title": "Default Role", "default": ""},
                    "date_added": {"type": "string", "format": "date-time", "title": "Date Added"},
                },
                "type": "object",
                "title": "RpcOrganization",
                "description": "The subset of organization metadata available from the control silo specifically.",
            },
            "RpcOrganizationMemberFlags": {
                "properties": {
                    "sso__linked": {"type": "boolean", "title": "Sso  Linked", "default": False},
                    "sso__invalid": {"type": "boolean", "title": "Sso  Invalid", "default": False},
                    "member_limit__restricted": {
                        "type": "boolean",
                        "title": "Member Limit  Restricted",
                        "default": False,
                    },
                    "idp__provisioned": {
                        "type": "boolean",
                        "title": "Idp  Provisioned",
                        "default": False,
                    },
                    "idp__role_restricted": {
                        "type": "boolean",
                        "title": "Idp  Role Restricted",
                        "default": False,
                    },
                    "partnership__restricted": {
                        "type": "boolean",
                        "title": "Partnership  Restricted",
                        "default": False,
                    },
                },
                "type": "object",
                "title": "RpcOrganizationMemberFlags",
                "description": "A serializable object that may be part of an RPC schema.",
            },
            "RpcTeamMember": {
                "properties": {
                    "id": {"type": "integer", "title": "Id", "default": -1},
                    "slug": {"type": "string", "title": "Slug", "default": ""},
                    "is_active": {"type": "boolean", "title": "Is Active", "default": False},
                    "role_id": {"type": "string", "title": "Role Id", "default": ""},
                    "project_ids": {
                        "items": {"type": "integer"},
                        "type": "array",
                        "title": "Project Ids",
                    },
                    "scopes": {"items": {"type": "string"}, "type": "array", "title": "Scopes"},
                    "team_id": {"type": "integer", "title": "Team Id", "default": -1},
                },
                "type": "object",
                "title": "RpcTeamMember",
                "description": "A serializable object that may be part of an RPC schema.",
            },
            "RpcOrganizationMember": {
                "properties": {
                    "id": {"type": "integer", "title": "Id", "default": -1},
                    "organization_id": {
                        "type": "integer",
                        "title": "Organization Id",
                        "default": -1,
                    },
                    "user_id": {"type": "integer", "title": "User Id"},
                    "flags": {"$ref": "#/components/schemas/RpcOrganizationMemberFlags"},
                    "member_teams": {
                        "items": {"$ref": "#/components/schemas/RpcTeamMember"},
                        "type": "array",
                        "title": "Member Teams",
                    },
                    "role": {"type": "string", "title": "Role", "default": ""},
                    "has_global_access": {
                        "type": "boolean",
                        "title": "Has Global Access",
                        "default": False,
                    },
                    "project_ids": {
                        "items": {"type": "integer"},
                        "type": "array",
                        "title": "Project Ids",
                    },
                    "scopes": {"items": {"type": "string"}, "type": "array", "title": "Scopes"},
                    "invite_status": {"type": "integer", "title": "Invite Status"},
                    "token": {"type": "string", "title": "Token", "default": ""},
                    "is_pending": {"type": "boolean", "title": "Is Pending", "default": False},
                    "invite_approved": {
                        "type": "boolean",
                        "title": "Invite Approved",
                        "default": False,
                    },
                    "token_expired": {
                        "type": "boolean",
                        "title": "Token Expired",
                        "default": False,
                    },
                    "legacy_token": {"type": "string", "title": "Legacy Token", "default": ""},
                    "email": {"type": "string", "title": "Email", "default": ""},
                },
                "type": "object",
                "title": "RpcOrganizationMember",
                "description": "A serializable object that may be part of an RPC schema.",
            },
            "RpcUserOrganizationContext": {
                "properties": {
                    "user_id": {"type": "integer", "title": "User Id"},
                    "organization": {"$ref": "#/components/schemas/RpcOrganization"},
                    "member": {"$ref": "#/components/schemas/RpcOrganizationMember"},
                },
                "type": "object",
                "title": "RpcUserOrganizationContext",
                "description": "This object wraps an organization result inside of its membership context in terms of an (optional) user id.\nThis is due to the large number of callsites that require an organization and a user's membership at the\nsame time and in a consistency state.  This object allows a nice envelop for both of these ideas from a single\ntransactional query.  Used by access, determine_active_organization, and others.",
            },
            "OrganizationService__get_organization_by_id__ReturnModel": {
                "properties": {
                    "value": {"$ref": "#/components/schemas/RpcUserOrganizationContext"}
                },
                "type": "object",
                "required": ["value"],
                "title": "OrganizationService__get_organization_by_id__ReturnModel",
            },
        }
    },
}
