"""
sentry.management.commands.repair
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.management.base import BaseCommand
from optparse import make_option


class Command(BaseCommand):
    help = 'Attempts to repair any invalid data within Sentry'

    option_list = BaseCommand.option_list + (
        make_option('--owner', help='Username to transfer ownerless projects to.'),
    )

    def handle(self, **options):
        from django.template.defaultfilters import slugify
        from sentry.models import Project, Team, ProjectKey, User
        from sentry.db.models import update

        if options.get('owner'):
            owner = User.objects.get(username__iexact=options.get('owner'))
        else:
            owner = None

        if owner:
            print "Assigning ownerless projects to %s" % owner.username
            # Assign unowned projects
            for project in Project.objects.filter(owner__isnull=True):
                update(project, owner=owner)
                print "* Changed owner of %s" % project

        # Create teams for any projects that are missing them
        print "Creating missing teams on projects"
        for project in Project.objects.filter(team__isnull=True, owner__isnull=False):
            team = Team(
                name=project.name,
                owner=project.owner,
            )
            base_slug = slugify(team.name)
            slug = base_slug
            n = 0
            while True:
                if Team.objects.filter(slug=slug).exists():
                    n += 1
                    slug = base_slug + '-' + str(n)
                    continue
                team.slug = slug
                break

            team.save()

            update(project, team=team)
            print "* Created team %s for %s" % (team, project)

        # Create missing project keys
        print "Creating missing project keys"
        for team in Team.objects.all():
            for member in team.member_set.select_related('user'):
                for project in team.project_set.all():
                    try:
                        created = ProjectKey.objects.get_or_create(
                            project=project,
                            user=member.user,
                        )[1]
                    except ProjectKey.MultipleObjectsReturned:
                        pass
                    else:
                        if created:
                            print "* Created key for %s on %s" % (member.user.username, project)
