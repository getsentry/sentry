import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import space from 'sentry/styles/space';

type Integration = {
  description: string;
  id: string;
  name: string;
};
const availabledIntegrations: Integration[] = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Triage, resolve, and ignore Sentry issues directly from Slack.',
  },

  {
    id: 'github',
    name: 'GitHub',
    description: 'Triage, resolve, and ignore Sentry issues directly from Slack.',
  },

  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Iterate more efficiently with Sentry in your GitLab flow.',
  },

  {
    id: 'jira',
    name: 'Jira',
    description: 'Connect errors from Sentry with your Jira issues.',
  },

  {
    id: 'bitbucket',
    name: 'Bitbucket',
    description: 'Connect Sentry to Bitbucket Repos and Pipelines.',
  },

  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Track errors collaboratively with one click.',
  },

  {
    id: 'msteams',
    name: 'MS Teams',
    description: 'Receive alerts when and where you want them, without disruption.',
  },
  {
    id: 'pagerduty',
    name: 'Pagerduty',
    description: 'Alert your team and triage in real time to avoid incidents.',
  },
  {
    id: 'vsts',
    name: 'Azure DevOps',
    description: 'Create or link issues in Asana based on Sentry events.',
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
    const selected = selectedIntegrationSet.has(integration.id);
    return (
      <IntegrationItem
        key={integration.id}
        selected={selectedIntegrationSet.has(integration.id)}
        onClick={() => props.selectIntegration(integration.id)}
      >
        <PluginIcon pluginId={integration.id} size={36} />
        <div>
          <h6>{integration.name}</h6>
          <p>{integration.description}</p>
        </div>
        {selected && (
          <ClearButton
            onClick={e => {
              props.removeIntegration(integration.id);
              e.stopPropagation();
            }}
            aria-label={t('Clear')}
          />
        )}
      </IntegrationItem>
    );
  };
  return <Wrapper>{availabledIntegrations.map(oneIntegration)}</Wrapper>;
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
