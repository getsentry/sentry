import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconContract, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TableActionButton} from 'sentry/views/explore/components/tableActionButton';

export interface TableExpando {
  button: React.ReactNode;
  enabled: boolean;
  expanded: boolean | undefined;
}

export function useTableExpando(): TableExpando {
  const organization = useOrganization();
  const location = useLocation();
  const enabled =
    organization.features.includes('ourlogs-table-expando') ||
    location.query.logsTableExpando === 'true';
  const [expandedState, setExpandedState] = useState(false);

  const [Icon, text] = expandedState
    ? [IconContract, t('Collapse')]
    : [IconExpand, t('Expand')];

  const toggleExpanded = useCallback(() => {
    setExpandedState(previousExpanded => !previousExpanded);
  }, []);

  const buttonProps = {
    'aria-label': text,
    icon: <Icon />,
    onClick: toggleExpanded,
    size: 'sm',
  } as const;

  return {
    button: (
      <TableActionButton
        desktop={<ExpandoButton {...buttonProps}>{text}</ExpandoButton>}
        mobile={<ExpandoButton {...buttonProps} />}
      />
    ),
    enabled,
    expanded: enabled ? expandedState : undefined,
  };
}

const ExpandoButton = styled(Button)`
  scroll-margin-top: ${p => p.theme.space.md};
`;
