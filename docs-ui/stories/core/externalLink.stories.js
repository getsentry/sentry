import ExternalLink from 'app/components/links/externalLink';

export default {
  title: 'Core/Typography/External Link',
  component: ExternalLink,
};

export const Default = () => (
  <ExternalLink href="https://www.sentry.io">Sentry</ExternalLink>
);

Default.storyName = 'External Link';
Default.parameters = {
  docs: {
    description: {
      story:
        'A normal anchor that opens URL in a new tab accounting for \'target="_blank"\' vulns',
    },
  },
};
