import operator
import sys
from collections import defaultdict
from functools import reduce

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from sentry.models import Organization, OrganizationMember, User


class Command(BaseCommand):
    help = "Attempts to repair any invalid data within Sentry"

    def add_arguments(self, parser):
        parser.add_argument(
            "--organization", help="Find all potential duplicate users within that organization."
        )
        parser.add_argument(
            "--noinput",
            dest="noinput",
            action="store_true",
            default=False,
            help="Dont ask for confirmation before merging accounts.",
        )
        parser.add_argument(
            "--no-delete",
            dest="delete",
            action="store_false",
            default=True,
            help="Don't remove merged accounts.",
        )

    def _get_organization_user_sets(self, organization):
        queryset = OrganizationMember.objects.filter(organization=organization).select_related(
            "user"
        )

        members_by_email = defaultdict(list)
        for member in queryset:
            if not member.user:
                continue
            members_by_email[member.user.email].append(member.user)

        return list(members_by_email.values())

    def _confirm_merge(self, primary_user, other_users):
        message = "Merge {} into {}? [Yn] ".format(
            ", ".join(o.username for o in other_users), primary_user.username
        )
        while True:
            response = input(message).strip().lower()
            if response in ("y", ""):
                return True
            elif response == "n":
                return False

    def handle(self, *usernames, **options):
        assert usernames or options.get("organization")

        noinput = options.get("noinput", False)

        if options.get("organization"):
            organization = Organization.objects.get_from_cache(slug=options["organization"])
        else:
            organization = None

        assert not (usernames and organization), "Must specify either username(s) or organization"

        unique_users = []
        if usernames:
            unique_users.append(
                list(
                    User.objects.filter(
                        reduce(
                            operator.or_,
                            [Q(username__iexact=u) | Q(email__iexact=u) for u in usernames],
                        )
                    )
                )
            )
        elif organization:
            unique_users = self._get_organization_user_sets(organization)
        else:
            raise CommandError("Must specify username(s) or organization")

        unique_users = [u for u in unique_users if len(u) > 1]

        if not unique_users:
            sys.stdout.write("No users with duplicate accounts found for merging.\n")
            return

        sys.stdout.write(
            f"Found {len(unique_users)} unique account(s) with duplicate identities.\n"
        )

        for user_list in unique_users:
            user_list.sort(
                key=lambda x: (x.is_active, x.is_superuser, not x.is_managed, x.date_joined)
            )

            primary_user = user_list[0]
            if not noinput and not self._confirm_merge(primary_user, user_list[1:]):
                continue

            for user in user_list[1:]:
                user.merge_to(primary_user)
                sys.stdout.write(f"{user.username} was merged into {primary_user.username}\n")

            if options["delete"]:
                for user in user_list[1:]:
                    user.delete()
