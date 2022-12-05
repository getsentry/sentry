import {useState} from 'react';
import styled from '@emotion/styled';

import {IconPlay} from 'sentry/icons';

function ViewHierarchy({hierarchy}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Container>
      <div style={{display: 'flex', alignItems: 'center'}}>
        {!!hierarchy.children.length && (
          <StyledExpandIcon
            fill="black"
            fillOpacity="1"
            size="xs"
            collapsed={collapsed}
            onClick={() => setCollapsed(!collapsed)}
          />
        )}
        {hierarchy.title}
      </div>

      {!collapsed &&
        !!hierarchy.children.length &&
        hierarchy.children.map(child => (
          <Container key={hierarchy.title}>
            <ViewHierarchy hierarchy={child} />
          </Container>
        ))}
    </Container>
  );
}

const Container = styled('div')`
  margin-left: 18px;
  margin-bottom: 4px;
`;

const StyledExpandIcon = styled(IconPlay)<{collapsed: boolean}>`
  margin-right: 4px;
  rotate: 90deg;
  ${p =>
    p.collapsed &&
    `
    rotate: 0deg;
  `}
`;

export default ViewHierarchy;
