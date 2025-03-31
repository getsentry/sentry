from rest_framework import serializers

ERR_RATE_LIMITED = "You are being rate limited for too many invitations."

# Required to explicitly define roles w/ descriptions because OrganizationMemberSerializer
# has the wrong descriptions, includes deprecated admin, and excludes billing
ROLE_CHOICES = [
    ("billing", "Can manage payment and compliance details."),
    (
        "member",
        "Can view and act on events, as well as view most other data within the organization.",
    ),
    (
        "manager",
        """Has full management access to all teams and projects. Can also manage
        the organization's membership.""",
    ),
    (
        "owner",
        """Has unrestricted access to the organization, its data, and its
        settings. Can add, modify, and delete projects and members, as well as
        make billing and plan changes.""",
    ),
    (
        "admin",
        """Can edit global integrations, manage projects, and add/remove teams.
        They automatically assume the Team Admin role for teams they join.
        Note: This role can no longer be assigned in Business and Enterprise plans. Use `TeamRoles` instead.
        """,
    ),
]


class MemberConflictValidationError(serializers.ValidationError):
    pass
