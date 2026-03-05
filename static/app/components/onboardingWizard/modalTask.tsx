import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';

type Props = {title?: string};

export default function ModalTask({title}: Props) {
  return (
    <TaskCard>
      <Title>
        <IconCheckmark variant="success" />
        {title}
      </Title>
    </TaskCard>
  );
}

const Title = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${p => p.theme.space.md};
  align-items: center;
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const TaskCard = styled(Card)`
  position: relative;
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
`;
