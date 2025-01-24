import styled from '@emotion/styled';

import {IconCircledNumber} from 'sentry/components/iconCircledNumber';
import {Tooltip} from 'sentry/components/tooltip';
import {IconMail} from 'sentry/icons';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';

const ActionMetadata = {
  slack: {name: t('Slack'), icon: <PluginIcon pluginId="slack" size={20} />},
  discord: {name: t('Discord'), icon: <PluginIcon pluginId={'discord'} size={20} />},
  email: {name: t('Email'), icon: <IconMail size="md" />},
};

export type Action = keyof typeof ActionMetadata;

type ActionCellProps = {
  actions: Action[];
};

export function ActionCell({actions}: ActionCellProps) {
  if (!actions || actions.length === 0) {
    return <div>{t('No actions')}</div>;
  }
  if (actions.length === 1 && actions[0]) {
    return (
      <Inline>
        <IconContainer>{ActionMetadata[actions[0]].icon}</IconContainer>
        {ActionMetadata[actions[0]].name}
      </Inline>
    );
  }
  const actionsList = actions
    .map(action => ActionMetadata[action].name)
    .reduce((acc, action) => `${acc}, ${action}`);
  return (
    <Inline>
      <IconContainer>
        <IconCircledNumber number={actions.length} />
      </IconContainer>
      <Tooltip title={actionsList}>
        <ActionsList>{actionsList}</ActionsList>
      </Tooltip>
    </Inline>
  );
}

const Inline = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(0.75)};
  align-items: center;
`;

const ActionsList = styled('span')`
  ${p => p.theme.tooltipUnderline()};
  text-overflow: ellipsis;
`;

const IconContainer = styled('div')`
  display: flex;
  justify-content: center;
  width: 20px;
  line-height: 0;
`;
