import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {IconCircledNumber} from 'sentry/components/iconCircledNumber';
import {Tooltip} from 'sentry/components/tooltip';
import {EmptyCell} from 'sentry/components/workflowEngine/gridCell/emptyCell';
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
    return <EmptyCell />;
  }
  if (actions.length === 1 && actions[0]) {
    return (
      <Flex align="center" gap={space(0.75)}>
        <IconContainer>{ActionMetadata[actions[0]].icon}</IconContainer>
        {ActionMetadata[actions[0]].name}
      </Flex>
    );
  }
  const actionsList = actions.map(action => ActionMetadata[action].name).join(', ');
  return (
    <Flex align="center" gap={space(0.75)}>
      <IconContainer>
        <IconCircledNumber number={actions.length} />
      </IconContainer>
      <Tooltip title={actionsList}>
        <ActionsList>{actionsList}</ActionsList>
      </Tooltip>
    </Flex>
  );
}

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
