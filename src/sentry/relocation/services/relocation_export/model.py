import pydantic


class RelocationExportRequestNewExportParameters(pydantic.BaseModel):
    relocation_uuid: str
    requesting_region_name: str
    replying_region_name: str
    org_slug: str
    encrypt_with_public_key: bytes


class RelocationExportReplyWithExportParameters(pydantic.BaseModel):
    relocation_uuid: str
    requesting_region_name: str
    replying_region_name: str
    org_slug: str
    # encrypted_bytes excluded, as receivers are expected to manually read them from filestore.
