import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import space from 'app/styles/space';
import {Organization, SentryFunction} from 'app/types';

type Props = {
  org: Organization;
  sentryFn: SentryFunction;

  onDelete: (org: Organization, sentryFn: SentryFunction) => void;
};

const ActionButtons = ({org, sentryFn, onDelete}: Props) => {
  const deleteButton = (
    <StyledButton
      size="small"
      icon={<IconDelete />}
      label="Delete"
      onClick={() => onDelete(org, sentryFn)}
    />
  );
  return <ButtonHolder>{deleteButton}</ButtonHolder>;
};

const StyledButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const ButtonHolder = styled('div')`
  flex-direction: row;
  display: flex;
  & > * {
    margin-left: ${space(0.5)};
  }
`;

export default ActionButtons;
