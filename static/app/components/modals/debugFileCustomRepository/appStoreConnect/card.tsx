import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconEdit, IconLock} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  children: React.ReactNode;
  onEdit: () => void;
};

function Card({children, onEdit}: Props) {
  return (
    <Wrapper>
      <IconWrapper>
        <IconLock size="lg" />
      </IconWrapper>
      <Content>{children}</Content>
      <Action>
        <Button icon={<IconEdit />} label={t('Edit')} size="small" onClick={onEdit} />
      </Action>
    </Wrapper>
  );
}

export default Card;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-gap: ${space(1)};
`;

const Content = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${space(1.5)};
`;

const Action = styled('div')`
  display: flex;
  align-items: center;
`;
