import {useCallback, useReducer, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {PanelAlert} from 'sentry/components/panels/panelAlert';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useQuery} from 'sentry/utils/queryClient';
import {convertRelayPiiConfig} from 'sentry/views/settings/components/dataScrubbing/convertRelayPiiConfig';

import {Rules} from './rules';

type Props = {
  organization: Organization;
};

export function OrganizationRules({organization}: Props) {
  const [isCollapsed, toggleIsCollapsed] = useReducer(prev => !prev, true);
  const [contentHeight, setContentHeight] = useState<string | undefined>();

  const {data: rules} = useQuery({
    queryKey: ['convertRelayPiiConfig', organization.relayPiiConfig],
    queryFn: () => {
      try {
        return convertRelayPiiConfig(organization.relayPiiConfig);
      } catch {
        addErrorMessage(t('Unable to load data scrubbing rules'));
        return null;
      }
    },
    networkMode: 'always',
    retry: 0,
    staleTime: 'static',
  });

  const measureRulesRef = useCallback(
    (node: HTMLUListElement | null) => {
      if (!contentHeight && node) {
        setContentHeight(`${node.offsetHeight}px`);
      }
    },
    [contentHeight]
  );

  if (!rules?.length) {
    return (
      <PanelAlert variant="info">
        {t('There are no data scrubbing rules at the organization level')}
      </PanelAlert>
    );
  }

  return (
    <Wrapper isCollapsed={isCollapsed} contentHeight={contentHeight}>
      <Header onClick={toggleIsCollapsed}>
        <div>{t('Organization Rules')}</div>
        <Button
          tooltipProps={{
            title: isCollapsed
              ? t('Expand Organization Rules')
              : t('Collapse Organization Rules'),
          }}
          icon={<IconChevron direction={isCollapsed ? 'down' : 'up'} />}
          size="xs"
          aria-label={t('Toggle Organization Rules')}
        />
      </Header>
      <Content>
        <Rules rules={rules} ref={measureRulesRef} disabled />
      </Content>
    </Wrapper>
  );
}

const Content = styled('div')`
  transition: height 300ms cubic-bezier(0.4, 0, 0.2, 1) 0ms;
  height: 0;
  overflow: hidden;
`;

const Header = styled('div')`
  cursor: pointer;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;

const Wrapper = styled('div')<{contentHeight?: string; isCollapsed?: boolean}>`
  color: ${p => p.theme.tokens.content.secondary};
  background: ${p => p.theme.tokens.background.secondary};
  ${p => !p.contentHeight && `padding: ${p.theme.space.md} ${p.theme.space.xl}`};
  ${p => !p.isCollapsed && ` border-bottom: 1px solid ${p.theme.tokens.border.primary}`};
  ${p =>
    !p.isCollapsed &&
    p.contentHeight &&
    css`
      ${Content} {
        height: ${p.contentHeight};
      }
    `}
`;
