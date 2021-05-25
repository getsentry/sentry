import * as React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {IconWarning} from 'app/icons';
import space from 'app/styles/space';
import {Meta, MetaError} from 'app/types';

import Chunks from './chunks';
import TagErrorTooltip from './tagErrorTooltip';
import {getTooltipText} from './utils';
import ValueElement from './valueElement';

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

  const renderErrors = (errors: Array<MetaError>) => {
    if (!errors.length) {
      return null;
    }

    return (
      <StyledTooltipError title={<TagErrorTooltip errors={errors} />}>
        <StyledIconWarning color="red300" />
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

const StyledIconWarning = styled(IconWarning)`
  vertical-align: middle;
`;
