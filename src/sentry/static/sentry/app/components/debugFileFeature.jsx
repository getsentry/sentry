import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Tooltip from 'app/components/tooltip';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';
import Tag from 'app/views/settings/components/tag';

function getFeatureTooltip(feature) {
  switch (feature) {
    case 'symtab':
      return t(
        'Symbol tables are used as a fallback when full debug information is not available'
      );
    case 'debug':
      return t(
        'Debug information provides function names and resolves inlined frames during symbolication'
      );
    case 'unwind':
      return t(
        'Stack unwinding information improves the quality of stack traces extracted from minidumps'
      );
    case 'sources':
      return t(
        'Source code information allows Sentry to display source code context for stack frames'
      );
    default:
      return null;
  }
}

function DebugFileFeature({available, feature}) {
  let icon = null;

  if (available === true) {
    icon = <Icon type="success" src="icon-checkmark-sm" />;
  } else if (available === false) {
    icon = <Icon type="error" src="icon-close" />;
  }

  return (
    <Tooltip title={getFeatureTooltip(feature)}>
      <Tag inline>
        {icon}
        {feature}
      </Tag>
    </Tooltip>
  );
}

DebugFileFeature.propTypes = {
  available: PropTypes.bool,
  feature: PropTypes.oneOf(['symtab', 'debug', 'unwind', 'sources']).isRequired,
};

const Icon = styled(InlineSvg)`
  color: ${p => p.theme.alert[p.type].iconColor};
  margin-right: 1ex;
`;

export default DebugFileFeature;
