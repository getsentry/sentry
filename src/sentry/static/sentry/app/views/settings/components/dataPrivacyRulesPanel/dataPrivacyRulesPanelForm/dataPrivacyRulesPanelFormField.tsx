import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {IconQuestion} from 'app/icons/iconQuestion';
import Tooltip from 'app/components/tooltip';
import space from 'app/styles/space';

type Props = {
  label: string;
  tooltipInfo: string;
  children: React.ReactNode;
  isFullWidth?: boolean;
};

const DataPrivacyRulesPanelFormField = ({
  label,
  tooltipInfo,
  children,
  isFullWidth,
}: Props) => (
  <Wrapper isFullWidth={isFullWidth}>
    <Label>
      <LabelDescription>{label}</LabelDescription>
      <Tooltip title={tooltipInfo} position="top">
        <IconQuestion color="gray1" />
      </Tooltip>
    </Label>
    {children}
  </Wrapper>
);

export default DataPrivacyRulesPanelFormField;

const Wrapper = styled('div')<{isFullWidth?: boolean}>`
  ${p =>
    p.isFullWidth &&
    css`
      grid-column-start: 1;
      grid-column-end: -1;
    `}
`;

const Label = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.5)};
`;

const LabelDescription = styled('span')`
  margin-right: ${space(1)};
`;
