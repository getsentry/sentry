import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {IconDelete} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {Organization, SentryFunction} from 'sentry/types';

type Props = {
  onDelete: (org: Organization, sentryFn: SentryFunction) => void;
  org: Organization;
  sentryFn: SentryFunction;
};

function ActionButtons({org, sentryFn, onDelete}: Props) {
  const deleteButton = (
    <StyledButton
      size="sm"
      icon={<IconDelete />}
      aria-label="Delete"
      onClick={() => onDelete(org, sentryFn)}
    />
  );
  return <ButtonHolder>{deleteButton}</ButtonHolder>;
}

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
