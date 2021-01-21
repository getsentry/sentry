import React from 'react';
import styled from '@emotion/styled';

import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

type Props = {
  children: React.ReactElement;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
};

function StatusTagTooltip({label, description, disabled, children}: Props) {
  return (
    <Tooltip
      title={
        <Title>
          <Label>{label}</Label>
          {description && <div>{description}</div>}
        </Title>
      }
      disabled={disabled}
    >
      {children}
    </Tooltip>
  );
}

export default StatusTagTooltip;

const Title = styled('div')`
  text-align: left;
`;

const Label = styled('div')`
  display: inline-block;
  margin-bottom: ${space(0.25)};
`;
