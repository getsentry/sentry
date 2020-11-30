import React from 'react';
import styled from '@emotion/styled';

import Tag from 'app/components/tag';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconClose} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';

const FEATURE_TOOLTIPS = {
  symtab: t(
    'Symbol tables are used as a fallback when full debug information is not available'
  ),
  debug: t(
    'Debug information provides function names and resolves inlined frames during symbolication'
  ),
  unwind: t(
    'Stack unwinding information improves the quality of stack traces extracted from minidumps'
  ),
  sources: t(
    'Source code information allows Sentry to display source code context for stack frames'
  ),
};

type Props = {
  feature: 'symtab' | 'debug' | 'unwind' | 'sources';
  available?: boolean;
};

const DebugFileFeature = ({available = true, feature}: Props) => {
  const tooltipText = FEATURE_TOOLTIPS[feature];
  if (available === true) {
    return (
      <Tooltip title={tooltipText}>
        <StyledTag type="success" icon={<IconCheckmark />}>
          {feature}
        </StyledTag>
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipText}>
      <StyledTag type="error" icon={<IconClose />}>
        {feature}
      </StyledTag>
    </Tooltip>
  );
};
export default DebugFileFeature;

const StyledTag = styled(Tag)`
  margin-left: ${space(1)};
`;
