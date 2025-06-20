from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration

# List of organization ids that are already using Seer and should have automation disabled
TARGET_ORGANIZATION_IDS = [
    16893,
    17008,
    21810,
    25281,
    25512,
    33498,
    35129,
    49449,
    56677,
    61191,
    70676,
    76375,
    79300,
    88557,
    89824,
    92087,
    116653,
    120015,
    132359,
    136556,
    136782,
    148466,
    153953,
    156279,
    169618,
    204013,
    206464,
    212020,
    233263,
    238697,
    241386,
    248881,
    270286,
    274716,
    285998,
    318400,
    339347,
    339978,
    353374,
    357644,
    371780,
    395628,
    411521,
    421293,
    436635,
    441793,
    454224,
    464708,
    471896,
    481744,
    483528,
    507761,
    515445,
    541491,
    560468,
    768682,
    881746,
    947830,
    964185,
    1025912,
    1101409,
    1112871,
    1113529,
    1156669,
    1206147,
    1243111,
    1269529,
    1276079,
    1309262,
    4503904770129920,
    4504038964264960,
    4504633921699840,
    4504933697781760,
    4505070533017600,
    4505329115398144,
    4505401764020224,
    4505607629504512,
    4505635668361216,
    4505646242070528,
    4505722323533824,
    4505804271845376,
    4505861490868224,
    4506030080393216,
    4506079834341376,
    4506246701973504,
    4506439126810624,
    4506557212721152,
    4506564668358656,
    4506657721679872,
    4506791527317504,
    4506856704573440,
    4506871577509888,
    4507012499046400,
    4507815623983104,
    4507847186251776,
    4507890192482304,
    4508042626269184,
    4508179443482624,
    4508287609733120,
    4508335783477248,
    4508358707118080,
    4508370676350976,
    4508968601321472,
    4509012087406592,
    4509106803048448,
    4509186130116617,
    4509315986227200,
    4509335811063808,
    4509359105114112,
    4509359473688576,
    4509379281813504,
    4509390286749696,
    4509390915174400,
    4509395891257344,
    4509401689686016,
    4509408715931648,
    4509408718422016,
    4509408721764352,
    4509410709536768,
    4509413026496512,
    4509428893220864,
    4509434032685056,
    4509445939331072,
    4509448277590016,
    4509459819266048,
    4509481628925952,
    4509483804262400,
    4509488548937728,
    4509506772926464,
    4509515415814144,
    4509516120260608,
    4509523739410432,
    4509525178580992,
    4507100456615936,
    4507180065095680,
    4507494139822080,
    4508207737864192,
    4508993652785152,
    4509004560138240,
    4509197776715776,
    4509203747438592,
    4509235638239232,
    4509241418907648,
    4509286801473536,
    4509406481416192,
    4509440991690752,
    4509480744976384,
    4509492900200448,
]


def disable_seer_automation_for_orgs(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    """
    Disable seer automation settings for specified organizations and their projects.

    For each target organization:
    - Sets sentry:default_seer_scanner_automation to False (only if currently False or None/undefined)
    - Sets sentry:default_autofix_automation_tuning to "off" (only if currently False or None/undefined)

    For each project in target organizations:
    - Sets sentry:seer_scanner_automation to False (only if currently False or None/undefined)
    - Sets sentry:autofix_automation_tuning to "off" (only if currently False or None/undefined)
    """
    Organization = apps.get_model("sentry", "Organization")
    Project = apps.get_model("sentry", "Project")
    OrganizationOption = apps.get_model("sentry", "OrganizationOption")
    ProjectOption = apps.get_model("sentry", "ProjectOption")

    for org_id in TARGET_ORGANIZATION_IDS:
        try:
            org = Organization.objects.get(id=org_id)

            _update_org_settings(org, OrganizationOption)

            projects = Project.objects.filter(organization_id=org_id)
            for project in projects:
                _update_project_settings(project, ProjectOption)

        except Organization.DoesNotExist:
            continue


def _update_org_settings(org, OrganizationOption):
    """Update organization-level seer automation settings."""
    # Update sentry:default_seer_scanner_automation
    scanner_key = "sentry:default_seer_scanner_automation"
    try:
        existing_scanner_option = OrganizationOption.objects.get(organization=org, key=scanner_key)
        existing_scanner = existing_scanner_option.value
    except OrganizationOption.DoesNotExist:
        existing_scanner = None

    if existing_scanner is False or existing_scanner is None:
        OrganizationOption.objects.update_or_create(
            organization=org, key=scanner_key, defaults={"value": False}
        )

    # Update sentry:default_autofix_automation_tuning
    autofix_key = "sentry:default_autofix_automation_tuning"
    try:
        existing_autofix_option = OrganizationOption.objects.get(organization=org, key=autofix_key)
        existing_autofix = existing_autofix_option.value
    except OrganizationOption.DoesNotExist:
        existing_autofix = None

    if existing_autofix is False or existing_autofix is None:
        OrganizationOption.objects.update_or_create(
            organization=org, key=autofix_key, defaults={"value": "off"}
        )


def _update_project_settings(project, ProjectOption):
    """Update project-level seer automation settings."""
    # Update sentry:seer_scanner_automation
    scanner_key = "sentry:seer_scanner_automation"
    try:
        existing_scanner_option = ProjectOption.objects.get(project=project, key=scanner_key)
        existing_scanner = existing_scanner_option.value
    except ProjectOption.DoesNotExist:
        existing_scanner = None

    if existing_scanner is False or existing_scanner is None:
        ProjectOption.objects.update_or_create(
            project=project, key=scanner_key, defaults={"value": False}
        )

    # Update sentry:autofix_automation_tuning
    autofix_key = "sentry:autofix_automation_tuning"
    try:
        existing_autofix_option = ProjectOption.objects.get(project=project, key=autofix_key)
        existing_autofix = existing_autofix_option.value
    except ProjectOption.DoesNotExist:
        existing_autofix = None

    if existing_autofix is False or existing_autofix is None:
        ProjectOption.objects.update_or_create(
            project=project, key=autofix_key, defaults={"value": "off"}
        )


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("sentry", "0930_make_open_period_range_boundary_inclusive"),
    ]

    operations = [
        migrations.RunPython(
            disable_seer_automation_for_orgs,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["sentry_organizationoptions", "sentry_projectoptions"]},
        ),
    ]
