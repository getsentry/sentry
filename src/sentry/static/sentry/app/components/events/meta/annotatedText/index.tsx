import React from 'react';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import Tooltip from 'app/components/tooltip';
import {tn} from 'app/locale';
import {Meta, MetaError} from 'app/types';
import space from 'app/styles/space';
import {List, ListItem} from 'app/components/list';

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
      <Tooltip
        title={
          <TooltipTitle>
            <strong>
              {tn('Processing Error:', 'Processing Errors:', errors.length)}
            </strong>
            <List>
              {errors.map((error, index) => (
                <StyledListItem key={index}>{getErrorMessage(error)}</StyledListItem>
              ))}
            </List>
          </TooltipTitle>
        }
      >
        <StyledIconWarning color="red500" />
      </Tooltip>
    );
  };

  return (
    <Wrapper {...props}>
      {renderValue()}
      {meta?.err && renderErrors(meta.err)}
    </Wrapper>
  );
};

export default AnnotatedText;

const Wrapper = styled('span')`
  display: inline-flex;
  align-items: center;
`;

const StyledIconWarning = styled(IconWarning)`
  padding-left: ${space(0.75)};
`;

const StyledListItem = styled(ListItem)`
  ul & {
    color: ${p => p.theme.white};
    &:before {
      border-color: ${p => p.theme.white};
    }
  }
`;

const TooltipTitle = styled('div')`
  text-align: left;
`;
