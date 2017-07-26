"""
Outputs a graphviz dot file of the dependencies.
"""

from __future__ import print_function

from optparse import make_option
import re
import textwrap

from django.core.management.base import BaseCommand
from django.core.management.color import no_style

from south.migration import Migrations, all_migrations

class Command(BaseCommand):

    help = "Outputs a GraphViz dot file of all migration dependencies to stdout."
    
    def handle(self, **options):
        
        # Resolve dependencies
        Migrations.calculate_dependencies()

        colors = [ 'crimson', 'darkgreen', 'darkgoldenrod', 'navy',
                'brown', 'darkorange', 'aquamarine' , 'blueviolet' ]
        color_index = 0
        wrapper = textwrap.TextWrapper(width=40)
        
        print("digraph G {")
        
        # Group each app in a subgraph
        for migrations in all_migrations():
            print("  subgraph %s {" % migrations.app_label())
            print("    node [color=%s];" % colors[color_index])
            for migration in migrations:
                # Munge the label - text wrap and change _ to spaces
                label = "%s - %s" % (
                        migration.app_label(), migration.name())
                label = re.sub(r"_+", " ", label)
                label=  "\\n".join(wrapper.wrap(label))
                print('    "%s.%s" [label="%s"];' % (
                        migration.app_label(), migration.name(), label))
            print("  }")
            color_index = (color_index + 1) % len(colors)

        # For every migration, print its links.
        for migrations in all_migrations():
            for migration in migrations:
                for other in migration.dependencies:
                    # Added weight tends to keep migrations from the same app
                    # in vertical alignment
                    attrs = "[weight=2.0]"
                    # But the more interesting edges are those between apps
                    if other.app_label() != migration.app_label():
                        attrs = "[style=bold]"
                    print('  "%s.%s" -> "%s.%s" %s;' % (
                        other.app_label(), other.name(),
                        migration.app_label(), migration.name(),
                        attrs
                    ))
            
        print("}");
