import styled from '@emotion/styled';

import Card from 'app/components/card';
import {tn} from 'app/locale';
import space from 'app/styles/space';
import {Event} from 'app/types/event';

type Props = {
  event: Event;
};

function NewIssue({event}: Props) {
  const {title, culprit, errors} = event;
  const errorCount = errors.length;
  return (
    <StyledCard interactive={false}>
      <div>
        <Title>{title}</Title>
        <CulPrint>{culprit}</CulPrint>
      </div>
      <ErrorsCount>
        {errorCount}
        <ErrorLabel>{tn('Error', 'Errors', errorCount)}</ErrorLabel>
      </ErrorsCount>
    </StyledCard>
  );
}

export default NewIssue;

const StyledCard = styled(Card)`
  margin-bottom: -1px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr max-content;
  align-items: center;
  padding: ${space(1.5)} ${space(2)};
  grid-gap: ${space(2)};
  word-break: break-word;
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: 700;
`;

const CulPrint = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const ErrorsCount = styled('div')`
  display: grid;
  align-items: center;
  justify-items: center;
`;

const ErrorLabel = styled('div')`
  text-transform: uppercase;
  font-weight: 500;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
`;
