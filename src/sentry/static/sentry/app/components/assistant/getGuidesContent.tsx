import React from 'react';

import {t, tct} from 'app/locale';
import {GuidesContent} from 'app/components/assistant/types';
import ExternalLink from 'app/components/links/externalLink';

export default function getGuidesContent(user): GuidesContent {
  const hasExperiment = user?.experiments?.AssistantGuideExperiment === 1;

  return [
    hasExperiment
      ? {
          guide: 'issue',
          requiredTargets: ['issue_title', 'exception'],
          steps: [
            {
              title: t("Let's Get This Over With"),
              target: 'issue_title',
              description: t(
                `No one likes a product tour. But stick with us, and you'll find it a
                whole lot easier to use Sentry's Issue details page.`
              ),
            },
            {
              title: t('Resolve Your Issues'),
              target: 'resolve',
              description: t(
                'So you fixed your problem? Congrats. Hit resolve to make it all go away.'
              ),
            },
            {
              title: t('Deal With It Later, Or Never'),
              target: 'ignore_delete_discard',
              description: t(
                `Just can't deal with this Issue right now? Ignore it. Saving it for later?
                Star it. Want it gone and out of your life forever?
                Delete that shi*t.`
              ),
            },
            {
              title: t('Identify Your Issues'),
              target: 'issue_number',
              description: tct(
                `You've got a lot of Issues. That's fine. Use the Issue number in your commit mesage,
                and we'll automatically resolve the Issue when your code is deployed. [link:Learn more]`,
                {link: <ExternalLink href="https://docs.sentry.io/learn/releases/" />}
              ),
            },
            {
              title: t('Annoy the Right People'),
              target: 'owners',
              description: tct(
                `Notification overload makes it tempting to hurl your phone into the ocean.
                Define who is responsible for what, so alerts reach the right people and your
                devices stay on dry land. [link:Learn more]`,
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/learn/issue-owners/" />
                  ),
                }
              ),
            },
            {
              title: t('Find Information You Can Use'),
              target: 'tags',
              description: t(
                `So many bugs, so little time. When you've got bugs as far as the mouse can scroll,
                search and filter Events with tags or visualize Issues with a heat map.`
              ),
            },
            {
              title: t('Narrow Down Suspects'),
              target: 'exception',
              description: t(
                `We've got stack trace. See the exact sequence of function calls leading to the error
                in question, no detective skills necessary.`
              ),
            },
            {
              title: t('Retrace Your Steps'),
              target: 'breadcrumbs',
              description: t(
                `Not sure how you got here? Sentry automatically captures breadcrumbs for events in web
                frameworks to lead you straight to your error.`
              ),
            },
          ],
        }
      : {
          guide: 'issue',
          requiredTargets: ['issue_title', 'exception'],
          steps: [
            {
              title: t('Issue Details'),
              target: 'issue_title',
              description: t(
                "The issue page contains all the details about an issue. Let's get started."
              ),
            },
            {
              title: t('Stacktrace'),
              target: 'exception',
              description: t(
                `See the sequence of function calls that led to the error, and global/local variables
                for each stack frame.`
              ),
            },
            {
              title: t('Breadcrumbs'),
              target: 'breadcrumbs',
              description: t(
                `Breadcrumbs are a trail of events that happened prior to the error. They're similar
                to traditional logs but can record more rich structured data. When Sentry is used with
                web frameworks, breadcrumbs are automatically captured for events like database calls and
                network requests.`
              ),
            },
            {
              title: t('Tags'),
              target: 'tags',
              description: t(
                `Attach arbitrary key-value pairs to each event which you can search and filter on.
                View a heatmap of all tags for an issue on the right panel.`
              ),
            },
            {
              title: t('Resolve'),
              target: 'resolve',
              description: tct(
                `Resolve an issue to remove it from your issue list. Sentry can also [link:alert you]
                when a new issue occurs or a resolved issue re-occurs.`,
                {link: <ExternalLink href="/settings/account/notifications/" />}
              ),
            },
            {
              title: t('Delete and Ignore'),
              target: 'ignore_delete_discard',
              description: t(
                `Delete an issue to remove it from your issue list until it happens again.
                Ignore an issue to remove it permanently or until certain conditions are met.`
              ),
            },
            {
              title: t('Issue Number'),
              target: 'issue_number',
              description: tct(
                `Include this unique identifier in your commit message to have Sentry automatically
                resolve the issue when your code is deployed. [link:Learn more]`,
                {link: <ExternalLink href="https://docs.sentry.io/learn/releases/" />}
              ),
            },
            {
              title: t('Ownership Rules'),
              target: 'owners',
              description: tct(
                `Define users or teams responsible for specific file paths or URLs so that alerts can
                be routed to the right person. [link:Learn more]`,
                {
                  link: (
                    <ExternalLink href="https://docs.sentry.io/learn/issue-owners/" />
                  ),
                }
              ),
            },
          ],
        },
    {
      guide: 'issue_stream',
      requiredTargets: ['issue_stream'],
      steps: [
        {
          title: t('Issues'),
          target: 'issue_stream',
          description: tct(
            `Sentry automatically groups similar events together into an issue. Similarity is
            determined by stacktrace and other factors. [link:Learn more].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/data-management/rollups/" />
              ),
            }
          ),
        },
      ],
    },
    {
      guide: 'discover_sidebar',
      requiredTargets: ['discover_sidebar'],
      steps: [
        {
          title: t('Event Pages have moved'),
          target: 'discover_sidebar',
          description: tct(
            `These are now in our powerful new query builder, Discover.
            [link:Learn more about its advanced features].`,
            {
              link: <ExternalLink href="https://docs.sentry.io/workflow/discover2/" />,
            }
          ),
        },
      ],
    },
  ];
}
