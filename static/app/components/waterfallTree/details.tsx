import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

const ValueTd = styled('td')`
  position: relative;
`;

const StyledText = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(2)} ${space(0)};
`;

export const TextTableRow = ({children}) => (
  <tr>
    <td className="key" />
    <ValueTd className="value">
      <StyledText>{children}</StyledText>
    </ValueTd>
  </tr>
);

export const DetailsTableRow = ({
  title,
  keep,
  children,
  extra = null,
}: {
  title: string;
  keep?: boolean;
  children: JSX.Element | string | null;
  extra?: React.ReactNode;
}) => {
  if (!keep && !children) {
    return null;
  }

  return (
    <tr>
      <td className="key">{title}</td>
      <ValueTd className="value">
        <pre className="val">
          <span className="val-string">{children}</span>
        </pre>
        {extra}
      </ValueTd>
    </tr>
  );
};

export const DetailsContent = styled('div')`
  padding: ${space(2)};
`;

export const DetailsContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.border};
  cursor: auto;
`;
