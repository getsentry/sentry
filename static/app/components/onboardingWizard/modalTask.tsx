import styled from '@emotion/styled';

import Card from 'sentry/components/card';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {space} from 'sentry/styles/space';

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
  gap: ${space(1)};
  align-items: center;
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const TaskCard = styled(Card)`
  position: relative;
  padding: ${space(2)} ${space(3)};
`;
