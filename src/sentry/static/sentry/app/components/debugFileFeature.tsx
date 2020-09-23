import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconClose} from 'app/icons';
import {t} from 'app/locale';
import Tag from 'app/components/tag';

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

const DebugFileFeature = ({available, feature}: Props) => {
  let icon: React.ReactNode = null;

  if (available === true) {
    icon = (
      <IconWrapper>
        <IconCheckmark size="sm" color="green500" />
      </IconWrapper>
    );
  } else if (available === false) {
    icon = (
      <IconWrapper>
        <IconClose size="sm" color="red400" />
      </IconWrapper>
    );
  }

  return (
    <Tooltip title={FEATURE_TOOLTIPS[feature]}>
      <Tag inline>
        {icon}
        {feature}
      </Tag>
    </Tooltip>
  );
};

DebugFileFeature.defaultProps = {
  available: true,
};

DebugFileFeature.propTypes = {
  available: PropTypes.bool,
  feature: PropTypes.oneOf(Object.keys(FEATURE_TOOLTIPS)).isRequired,
};

DebugFileFeature.defaultProps = {
  available: true,
};

const IconWrapper = styled('span')`
  margin-right: 1ex;
`;

export default DebugFileFeature;
