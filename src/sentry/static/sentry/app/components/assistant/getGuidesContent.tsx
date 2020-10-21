import {t, tct} from 'app/locale';
import {GuidesContent} from 'app/components/assistant/types';
import ExternalLink from 'app/components/links/externalLink';

export default function getGuidesContent(): GuidesContent {
  return [
    {
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
                Delete that sh*t.`
          ),
        },
        {
          title: t('Identify Your Issues'),
          target: 'issue_number',
          description: tct(
            `You've got a lot of Issues. That's fine. Use the Issue number in your commit message,
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
              link: <ExternalLink href="https://docs.sentry.io/learn/issue-owners/" />,
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
      guide: 'dynamic_counts',
      requiredTargets: ['dynamic_counts'],
      steps: [
        {
          title: t('These counts have changed'),
          target: 'dynamic_counts',
          description: t(
            `These numbers and the bar chart now respect the time selected and any search
            filters you've applied. You can hover to see the totals.`
          ),
        },
      ],
    },
  ];
}
