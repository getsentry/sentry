from __future__ import annotations

from contextlib import contextmanager
from io import BytesIO
from typing import Callable, Generator, Sequence, TextIO

import click

from sentry.backup.comparators import get_default_comparators
from sentry.backup.findings import Finding, FindingJSONEncoder
from sentry.backup.helpers import (
    DecryptionError,
    ImportFlags,
    Side,
    create_encrypted_export_tarball,
    decrypt_encrypted_tarball,
)
from sentry.backup.validate import validate
from sentry.runner.decorators import configuration
from sentry.utils import json

DEFAULT_INDENT = 2

DECRYPT_WITH_HELP = """A path to a file containing a private key with which to decrypt a tarball
                    previously encrypted using an `export ... --encrypt_with=<PUBLIC_KEY>` command.
                    The private key provided via this flag should be the complement of the public
                    key used to encrypt the tarball (this public key is included in the tarball
                    itself).

                    This flag is mutually exclusive with the `--decrypt-with-gcp-kms` flag."""

DECRYPT_WITH_GCP_KMS_HELP = """For users that want to avoid storing their own private keys, this
                            flag can be used in lieu of `--decrypt-with` to retrieve keys from
                            Google Cloud's Key Management Service directly, avoiding ever storing
                            them on the machine doing the decryption.

                            This flag should point to a JSON file containing a single top-level
                            object storing the `project-id`, `location`, `keyring`, `key`, and
                            `version` of the desired asymmetric private key that pairs with the
                            public key included in the tarball being imported (for more information
                            on these resource identifiers and how to set up KMS to use the, see:
                            https://cloud.google.com/kms/docs/getting-resource-ids). An example
                            version of this file might look like:

                            ``` {
                                "project_id": "my-google-cloud-project",
                                "location": "global",
                                "key_ring": "my-key-ring-name",
                                "key": "my-key-name",
                                "version": "1"
                            }
                            ```

                            Property names must be spelled exactly as above, and the `version`
                            field in particular must be a string, not an integer."""

ENCRYPT_WITH_HELP = """A path to the a public key with which to encrypt this export. If this flag is
                       enabled and points to a valid key, the output file will be a tarball
                       containing 3 constituent files: 1. An encrypted JSON file called
                       `export.json`, which is encrypted using 2. An asymmetrically encrypted data
                       encryption key (DEK) called `data.key`, which is itself encrypted by 3. The
                       public key contained in the file supplied to this flag, called `key.pub`. To
                       decrypt the exported JSON data, decryptors should use the private key paired
                       with `key.pub` to decrypt the DEK, which can then be used to decrypt the
                       export data in `export.json`."""

FINDINGS_FILE_HELP = """Optional file that records comparator findings, saved in the JSON format.
                     If left unset, no such file is written."""

INDENT_HELP = "Number of spaces to indent for the JSON output. (default: 2)"

MERGE_USERS_HELP = """If this flag is set and users in the import JSON have matching usernames to
                   those already in the database, the existing users are used instead and their
                   associated user scope models are not updated. If this flag is not set, new users
                   are always created in the event of a collision, with the new user receiving a
                   random suffix to their username."""

OVERWRITE_CONFIGS_HELP = """Imports are generally non-destructive of old data. However, if this flag
                         is set and a global configuration, like an option or a relay id, collides
                         with an existing value, the new value will overwrite the existing one. If
                         the flag is left in its (default) unset state, the old value will be
                         retained in the event of a collision."""


def get_printer(silent: bool) -> Callable:
    if silent:
        return lambda *args, **kwargs: None
    else:
        return click.echo


def parse_filter_arg(filter_arg: str) -> set[str] | None:
    filter_by = None
    if filter_arg:
        filter_by = set(filter_arg.split(","))

    return filter_by


def get_decryptor_io_from_flags(
    decrypt_with: BytesIO | None, decrypt_with_gcp_kms: BytesIO | None
) -> BytesIO | None:
    if decrypt_with is not None and decrypt_with_gcp_kms is not None:
        raise click.UsageError(
            """`--decrypt-with` and `--decrypt-with-gcp-kms` are mutually exclusive options - you may use one or the other, but not both."""
        )
    return decrypt_with if decrypt_with is not None else decrypt_with_gcp_kms


def write_findings(findings_file: TextIO | None, findings: Sequence[Finding], printer: Callable):
    for f in findings:
        printer(f.pretty(), err=True)

    if findings_file:
        findings_encoder = FindingJSONEncoder(
            sort_keys=True,
            ensure_ascii=True,
            check_circular=True,
            allow_nan=True,
            indent=DEFAULT_INDENT,
            encoding="utf-8",
        )

        with findings_file as file:
            encoded = findings_encoder.encode(findings)
            file.write(encoded)


@contextmanager
def write_import_findings(
    findings_file: TextIO | None, printer: Callable
) -> Generator[None, None, None]:
    """
    Helper that ensures that we write findings for the `import ...` command regardless of outcome.
    """

    from sentry.backup.imports import ImportingError

    try:
        yield
    except ImportingError as e:
        if e.context:
            write_findings(findings_file, [e.context], printer)
        raise e
    else:
        write_findings(findings_file, [], printer)


@contextmanager
def write_export_findings(
    findings_file: TextIO | None, printer: Callable
) -> Generator[None, None, None]:
    """
    Helper that ensures that we write findings for the `export ...` command regardless of outcome.
    """

    from sentry.backup.exports import ExportingError

    try:
        yield
    except ExportingError as e:
        if e.context:
            write_findings(findings_file, [e.context], printer)
        raise e
    else:
        write_findings(findings_file, [], printer)


@click.group(name="backup")
def backup():
    """A collection of helper tools for operating on backup Sentry backup imports/exports."""


@backup.command(name="compare")
@click.argument("left", type=click.File("rb"))
@click.argument("right", type=click.File("rb"))
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--decrypt-left-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-left-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--decrypt-right-with",
    type=click.File("rb"),
    help="Identical to `--decrypt-left-with`, but for the 2nd input argument.",
)
@click.option(
    "--decrypt-right-with-gcp-kms",
    type=click.File("rb"),
    help="Identical to `--decrypt-left-with-gcp-kms`, but for the 2nd input argument.",
)
@configuration
def compare(
    left,
    right,
    decrypt_left_with,
    decrypt_left_with_gcp_kms,
    decrypt_right_with,
    decrypt_right_with_gcp_kms,
    findings_file,
):
    """
    Compare two exports generated by the `export` command for equality, modulo certain necessary
    expected differences like `date_updated` timestamps, unique tokens, and the like.
    """

    # Helper function that loads data from one of the two sides, decrypting it if necessary along
    # the way.
    def load_data(
        side: Side, src: BytesIO, decrypt_with: BytesIO, decrypt_with_gcp_kms: BytesIO
    ) -> json.JSONData:
        decrypt_io = get_decryptor_io_from_flags(decrypt_with, decrypt_with_gcp_kms)

        # Decrypt the tarball, if the user has indicated that this is one by using either of the
        # `--decrypt...` flags.
        if decrypt_io is not None:
            try:
                input = BytesIO(
                    decrypt_encrypted_tarball(src, decrypt_with_gcp_kms is not None, decrypt_io)
                )
            except DecryptionError as e:
                click.echo(f"Invalid {side.name} side tarball: {str(e)}", err=True)
        else:
            input = src

        # Now read the input string into memory as JSONData.
        try:
            data = json.load(input)
        except json.JSONDecodeError:
            click.echo(f"Invalid {side.name} JSON", err=True)

        return data

    with left:
        left_data = load_data(Side.left, left, decrypt_left_with, decrypt_left_with_gcp_kms)
    with right:
        right_data = load_data(Side.right, right, decrypt_right_with, decrypt_right_with_gcp_kms)

    res = validate(left_data, right_data, get_default_comparators())
    if res:
        write_findings(findings_file, res.findings, click.echo)
        click.echo(f"Done, found {len(res.findings)} differences:\n\n{res.pretty()}")
    else:
        write_findings(findings_file, [], click.echo)
        click.echo("Done, found 0 differences!")


@backup.command(name="decrypt")
@click.argument("dest", type=click.File("wb"))
@click.option(
    "--decrypt-with",
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--src",
    required=True,
    type=click.File("rb"),
    help="The output tarball file that needs to be decrypted.",
)
@configuration
def decrypt(dest, decrypt_with, decrypt_with_gcp_kms, src):
    """
    Decrypt an encrypted tarball export into an unencrypted JSON file.
    """

    # Decrypt the tarball, if the user has indicated that this is one by using either of the
    # `--decrypt...` flags.
    decrypt_io = get_decryptor_io_from_flags(decrypt_with, decrypt_with_gcp_kms)
    if decrypt_io is None:
        raise click.UsageError(
            """You must specify one of `--decrypt-with` or `--decrypt-with-gcp-kms`."""
        )

    try:
        decrypted = decrypt_encrypted_tarball(src, decrypt_with_gcp_kms is not None, decrypt_io)
    except DecryptionError as e:
        click.echo(f"Invalid tarball: {str(e)}", err=True)

    with dest:
        dest.write(decrypted)


@backup.command(name="encrypt")
@click.argument("dest", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    required=True,
    type=click.File("rb"),
    help="The file containing the public key RSA file to be used for encryption.",
)
@click.option(
    "--src",
    required=True,
    type=click.File("rb"),
    help="The input JSON file that needs to be encrypted.",
)
@configuration
def encrypt(dest, encrypt_with, src):
    """
    Encrypt an unencrypted raw JSON export into an encrypted tarball.
    """

    try:
        data = json.load(src)
    except json.JSONDecodeError:
        click.echo("Invalid input JSON", err=True)

    encrypted = create_encrypted_export_tarball(data, encrypt_with)
    with dest:
        dest.write(encrypted.getbuffer())


@click.group(name="import")
def import_():
    """Performs non-destructive imports of core data for a Sentry installation."""


@import_.command(name="users")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    "--decrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--filter-usernames",
    "--filter_usernames",  # For backwards compatibility with self-hosted@23.10.0
    default="",
    type=str,
    help="An optional comma-separated list of users to include. "
    "If this option is not set, all encountered users are imported.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--merge-users",
    "--merge_users",  # For backwards compatibility with self-hosted@23.10.0
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_users(
    src,
    decrypt_with,
    decrypt_with_gcp_kms,
    filter_usernames,
    findings_file,
    merge_users,
    silent,
):
    """
    Import the Sentry users from an exported JSON file.
    """

    from sentry.backup.imports import import_in_user_scope

    printer = get_printer(silent)
    with write_import_findings(findings_file, printer):
        import_in_user_scope(
            src,
            decrypt_with=get_decryptor_io_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=ImportFlags(
                merge_users=merge_users,
                decrypt_using_gcp_kms=decrypt_with_gcp_kms is not None,
            ),
            user_filter=parse_filter_arg(filter_usernames),
            printer=printer,
        )


@import_.command(name="organizations")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    "--decrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--filter-org-slugs",
    "--filter_org_slugs",  # For backwards compatibility with self-hosted@23.10.0
    default="",
    type=str,
    help="An optional comma-separated list of organization slugs to include. "
    "If this option is not set, all encountered organizations are imported. "
    "Users not members of at least one organization in this set will not be imported.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--merge-users",
    "--merge_users",  # For backwards compatibility with self-hosted@23.10.0
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_organizations(
    src,
    decrypt_with,
    decrypt_with_gcp_kms,
    filter_org_slugs,
    findings_file,
    merge_users,
    silent,
):
    """
    Import the Sentry organizations, and all constituent Sentry users, from an exported JSON file.
    """

    from sentry.backup.imports import import_in_organization_scope

    printer = get_printer(silent)
    with write_import_findings(findings_file, printer):
        import_in_organization_scope(
            src,
            decrypt_with=get_decryptor_io_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=ImportFlags(
                merge_users=merge_users,
                decrypt_using_gcp_kms=decrypt_with_gcp_kms is not None,
            ),
            org_filter=parse_filter_arg(filter_org_slugs),
            printer=printer,
        )


@import_.command(name="config")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    "--decrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--merge-users",
    "--merge_users",  # For backwards compatibility with self-hosted@23.10.0
    default=False,
    is_flag=True,
    help=MERGE_USERS_HELP,
)
@click.option(
    "--overwrite-configs",
    "--overwrite_configs",  # For backwards compatibility with self-hosted@23.10.0
    default=False,
    is_flag=True,
    help=OVERWRITE_CONFIGS_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_config(
    src,
    decrypt_with,
    decrypt_with_gcp_kms,
    findings_file,
    merge_users,
    overwrite_configs,
    silent,
):
    """
    Import all configuration and administrator accounts needed to set up this Sentry instance.
    """

    from sentry.backup.imports import import_in_config_scope

    printer = get_printer(silent)
    with write_import_findings(findings_file, printer):
        import_in_config_scope(
            src,
            decrypt_with=get_decryptor_io_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=ImportFlags(
                merge_users=merge_users,
                overwrite_configs=overwrite_configs,
                decrypt_using_gcp_kms=decrypt_with_gcp_kms is not None,
            ),
            printer=printer,
        )


@import_.command(name="global")
@click.argument("src", type=click.File("rb"))
@click.option(
    "--decrypt-with",
    "--decrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=DECRYPT_WITH_HELP,
)
@click.option(
    "--decrypt-with-gcp-kms",
    type=click.File("rb"),
    help=DECRYPT_WITH_GCP_KMS_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--overwrite-configs",
    "--overwrite_configs",  # For backwards compatibility with self-hosted@23.10.0
    default=False,
    is_flag=True,
    help=OVERWRITE_CONFIGS_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def import_global(
    src,
    decrypt_with,
    decrypt_with_gcp_kms,
    findings_file,
    overwrite_configs,
    silent,
):
    """
    Import all Sentry data from an exported JSON file.
    """

    from sentry.backup.imports import import_in_global_scope

    printer = get_printer(silent)
    with write_import_findings(findings_file, printer):
        import_in_global_scope(
            src,
            decrypt_with=get_decryptor_io_from_flags(decrypt_with, decrypt_with_gcp_kms),
            flags=ImportFlags(
                overwrite_configs=overwrite_configs,
                decrypt_using_gcp_kms=decrypt_with_gcp_kms is not None,
            ),
            printer=printer,
        )


@click.group(name="export")
def export():
    """Exports core data for the Sentry installation."""


@export.command(name="users")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    "--encrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--filter-usernames",
    "--filter_usernames",  # For backwards compatibility with self-hosted@23.10.0
    default="",
    type=str,
    help="An optional comma-separated list of users to include. "
    "If this option is not set, all encountered users are imported.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def export_users(dest, encrypt_with, filter_usernames, findings_file, indent, silent):
    """
    Export all Sentry users in the JSON format.
    """

    from sentry.backup.exports import export_in_user_scope

    printer = get_printer(silent)
    with write_export_findings(findings_file, printer):
        export_in_user_scope(
            dest,
            encrypt_with=encrypt_with,
            indent=indent,
            user_filter=parse_filter_arg(filter_usernames),
            printer=printer,
        )


@export.command(name="organizations")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    "--encrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--filter-org-slugs",
    "--filter_org_slugs",  # For backwards compatibility with self-hosted@23.10.0
    default="",
    type=str,
    help="An optional comma-separated list of organization slugs to include. "
    "If this option is not set, all encountered organizations are exported. "
    "Users not members of at least one organization in this set will not be exported.",
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def export_organizations(dest, encrypt_with, filter_org_slugs, findings_file, indent, silent):
    """
    Export all Sentry organizations, and their constituent users, in the JSON format.
    """

    from sentry.backup.exports import export_in_organization_scope

    printer = get_printer(silent)
    with write_export_findings(findings_file, printer):
        export_in_organization_scope(
            dest,
            encrypt_with=encrypt_with,
            indent=indent,
            org_filter=parse_filter_arg(filter_org_slugs),
            printer=printer,
        )


@export.command(name="config")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    "--encrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def export_config(dest, encrypt_with, findings_file, indent, silent):
    """
    Export all configuration and administrator accounts needed to set up this Sentry instance.
    """

    from sentry.backup.exports import export_in_config_scope

    printer = get_printer(silent)
    with write_export_findings(findings_file, printer):
        export_in_config_scope(
            dest,
            encrypt_with=encrypt_with,
            indent=indent,
            printer=printer,
        )


@export.command(name="global")
@click.argument("dest", default="-", type=click.File("wb"))
@click.option(
    "--encrypt-with",
    "--encrypt_with",  # For backwards compatibility with self-hosted@23.10.0
    type=click.File("rb"),
    help=ENCRYPT_WITH_HELP,
)
@click.option(
    "--findings-file",
    type=click.File("w"),
    required=False,
    help=FINDINGS_FILE_HELP,
)
@click.option(
    "--indent",
    default=2,
    type=int,
    help=INDENT_HELP,
)
@click.option("--silent", "-q", default=False, is_flag=True, help="Silence all debug output.")
@configuration
def export_global(dest, encrypt_with, findings_file, indent, silent):
    """
    Export all Sentry data in the JSON format.
    """

    from sentry.backup.exports import export_in_global_scope

    printer = get_printer(silent)
    with write_export_findings(findings_file, printer):
        export_in_global_scope(
            dest,
            encrypt_with=encrypt_with,
            indent=indent,
            printer=printer,
        )
