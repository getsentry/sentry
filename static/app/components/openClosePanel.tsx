import {Fragment, ReactNode, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  header: (boolean) => ReactNode;
  openByDefault: boolean;
  children?: ReactNode;
}

export default function OpenClosePanel(props: Props) {
  const [isOpen, setIsOpen] = useState(props.openByDefault);

  return (
    <Fragment>
      <ListItemContainer>
        <Button
          icon={<IconChevron size="xs" direction={isOpen ? 'up' : 'down'} />}
          aria-label={t('Open')}
          aria-expanded={isOpen}
          size="sm"
          borderless
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          {props.header(isOpen)}
        </Button>
      </ListItemContainer>
      {isOpen ? props.children : null}
    </Fragment>
  );
}

const ListItemContainer = styled('div')`
  display: flex;
`;
