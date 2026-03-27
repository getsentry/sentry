import {useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {IconContract, IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {TableActionButton} from 'sentry/views/explore/components/tableActionButton';

interface Expando {
  button: React.ReactNode;
  expanded: boolean;
}

export function useExpando(): Expando {
  const [expanded, setExpanded] = useState(false);

  const [Icon, text] = expanded
    ? [IconContract, t('Collapse')]
    : [IconExpand, t('Expand')];

  const toggleExpanded = useCallback(() => {
    setExpanded(previousExpanded => !previousExpanded);
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
    expanded,
  };
}

const ExpandoButton = styled(Button)`
  scroll-margin-top: ${p => p.theme.space.md};
`;
