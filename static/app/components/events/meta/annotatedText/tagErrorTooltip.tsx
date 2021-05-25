import styled from '@emotion/styled';

import {getErrorMessage} from 'app/components/events/meta/annotatedText/utils';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {MetaError} from 'app/types';

type Props = {
  errors: Array<MetaError>;
};

const TagErrorTooltip = ({errors}: Props) => {
  if (errors.length === 1) {
    return <TooltipTitle>{t('Error: %s', getErrorMessage(errors[0]))}</TooltipTitle>;
  }
  return (
    <TooltipTitle>
      <span>{t('Errors:')}</span>
      <StyledList symbol="bullet">
        {errors.map((error, index) => (
          <ListItem key={index}>{getErrorMessage(error)}</ListItem>
        ))}
      </StyledList>
    </TooltipTitle>
  );
};

export default TagErrorTooltip;

const StyledList = styled(List)`
  li {
    padding-left: ${space(3)};
    word-break: break-all;
    :before {
      border-color: ${p => p.theme.white};
      top: 6px;
    }
  }
`;

const TooltipTitle = styled('div')`
  text-align: left;
`;
