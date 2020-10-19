import React from 'react';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import {tn} from 'app/locale';
import {Meta, MetaError} from 'app/types';
import space from 'app/styles/space';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';

import {getTooltipText} from './utils';
import ValueElement from './valueElement';
import Chunks from './chunks';

type Props = {
  value: React.ReactNode;
  meta?: Meta;
};

const AnnotatedText = ({value, meta, ...props}: Props) => {
  const renderValue = () => {
    if (meta?.chunks?.length && meta.chunks.length > 1) {
      return <Chunks chunks={meta.chunks} />;
    }

    const element = <ValueElement value={value} meta={meta} />;

    if (meta?.rem?.length) {
      const title = getTooltipText({rule_id: meta.rem[0][0], remark: meta.rem[0][1]});
      return <Tooltip title={title}>{element}</Tooltip>;
    }

    return element;
  };

  const getErrorMessage = (error: MetaError) => {
    const errorMessage: string[] = [];

    if (error[0]) {
      errorMessage.push(error[0]);
    }

    if (error[1]?.reason) {
      errorMessage.push(error[1].reason);
    }

    return errorMessage.join(': ');
  };

  const renderErrors = (errors: Array<MetaError>) => {
    if (!errors.length) {
      return null;
    }

    return (
      <StyledTooltipError
        title={
          <TooltipTitle>
            <strong>
              {tn('Processing Error:', 'Processing Errors:', errors.length)}
            </strong>
            <StyledList symbol="bullet">
              {errors.map((error, index) => (
                <StyledListItem key={index}>{getErrorMessage(error)}</StyledListItem>
              ))}
            </StyledList>
          </TooltipTitle>
        }
      >
        <StyledIconWarning color="red500" />
      </StyledTooltipError>
    );
  };

  return (
    <span {...props}>
      {renderValue()}
      {meta?.err && renderErrors(meta.err)}
    </span>
  );
};

export default AnnotatedText;

const StyledTooltipError = styled(Tooltip)`
  margin-left: ${space(0.75)};
  vertical-align: middle;
`;

const StyledListItem = styled(ListItem)`
  padding-left: ${space(3)};
`;

const StyledList = styled(List)`
  li:before {
    border-color: ${p => p.theme.white};
  }
`;

const TooltipTitle = styled('div')`
  text-align: left;
`;

const StyledIconWarning = styled(IconWarning)`
  vertical-align: middle;
`;
