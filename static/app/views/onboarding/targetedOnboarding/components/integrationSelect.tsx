import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';

type Integration = {
  description: string;
  name: string;
  slug: string;
};
// TODO: We might want to put this on the backend eventually for centralized source of truth.
export const onboardingIntegrations: Integration[] = [
  {
    slug: 'slack',
    name: 'Slack',
    description: 'Triage, resolve, and ignore Sentry issues directly from Slack.',
  },
  {
    slug: 'github',
    name: 'GitHub',
    description: 'Automate issue assignment and release tracking with Github.',
  },
  {
    slug: 'gitlab',
    name: 'GitLab',
    description: 'Iterate more efficiently with Sentry in your GitLab flow.',
  },
  {
    slug: 'jira',
    name: 'Jira',
    description: 'Connect errors from Sentry with your Jira issues.',
  },
  {
    slug: 'bitbucket',
    name: 'Bitbucket',
    description: 'Connect Sentry to Bitbucket Repos and Pipelines.',
  },
  {
    slug: 'vercel',
    name: 'Vercel',
    description: 'Automatically notify Sentry of new deployments in Vercel.',
  },
  {
    slug: 'msteams',
    name: 'MS Teams',
    description: 'Receive alerts when and where you want them, without disruption.',
  },
  {
    slug: 'pagerduty',
    name: 'Pagerduty',
    description: 'Alert your team and triage in real time to avoid incidents.',
  },
  {
    slug: 'vsts',
    name: 'Azure DevOps',
    description: 'Manage, sync, and track your issues with Azure DevOps commit data.',
  },
];

type Props = {
  removeIntegration: (string) => void;
  selectIntegration: (string) => void;
  selectedIntegrations: string[];
};

export default function IntegrationMultiSelect(props: Props) {
  const selectedIntegrationSet = new Set(props.selectedIntegrations);
  const oneIntegration = (integration: Integration) => {
    const selected = selectedIntegrationSet.has(integration.slug);
    return (
      <IntegrationItem
        key={integration.slug}
        selected={selectedIntegrationSet.has(integration.slug)}
        onClick={() => props.selectIntegration(integration.slug)}
      >
        <PluginIcon pluginId={integration.slug} size={36} />
        <div>
          <h6>{integration.name}</h6>
          <p>{integration.description}</p>
        </div>
        {selected && (
          <ClearButton
            onClick={e => {
              props.removeIntegration(integration.slug);
              e.stopPropagation();
            }}
            aria-label={t('Clear')}
          />
        )}
      </IntegrationItem>
    );
  };
  return <Wrapper>{onboardingIntegrations.map(oneIntegration)}</Wrapper>;
}

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(min(100%, max(256px, calc(100% / 3 - ${space(2)}))), 1fr)
  );
  gap: ${space(2)};
  justify-content: center;
`;
const ClearButton = styled(Button)`
  position: absolute;
  top: -6px;
  right: -6px;
  min-height: 0;
  height: 22px;
  width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
`;
ClearButton.defaultProps = {
  icon: <IconClose isCircled size="xs" />,
  borderless: true,
  size: 'xsmall',
};
const IntegrationItem = styled('div')<{selected: boolean}>`
  display: flex;
  flex-direction: row;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
  position: relative;
  ${PluginIcon} {
    flex-shrink: 0;
    flex-grow: 0;
    margin-right: ${space(2)};
  }
  h6 {
    margin-bottom: ${space(1)};
  }
  p {
    margin: 0;
  }
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.alert.muted.backgroundLight};
  }
  ${p =>
    p.selected &&
    `
    background-color: ${p.theme.alert.info.backgroundLight} !important;
    `}
`;
