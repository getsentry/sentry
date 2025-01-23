import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {IconMail} from 'sentry/icons';
import {IconCircledNumber} from 'sentry/icons/iconCircledNumber';
import {t} from 'sentry/locale';
import PluginIcon from 'sentry/plugins/components/pluginIcon';
import {space} from 'sentry/styles/space';

export enum Action {
  SLACK = 'slack',
  DISCORD = 'discord',
  EMAIL = 'email',
}

const ActionToIcon = {
  [Action.SLACK]: <PluginIcon pluginId={'slack'} size={20} />,
  [Action.DISCORD]: <PluginIcon pluginId={'discord'} size={20} />,
  [Action.EMAIL]: <IconMail size={'md'} />,
};

const ActionToName = {
  [Action.SLACK]: 'Slack',
  [Action.DISCORD]: 'Discord',
  [Action.EMAIL]: 'Email',
};

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
        <IconContainer>{ActionToIcon[actions[0]]}</IconContainer>
        {ActionToName[actions[0]]}
      </Inline>
    );
  }
  const actionsList = actions
    .map(action => ActionToName[action])
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
