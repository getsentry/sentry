import {useState} from 'react';
import styled from '@emotion/styled';

import {IconPlay} from 'sentry/icons';

function ViewHierarchy({hierarchy}) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Container>
      <div>
        {!!hierarchy.children.length && (
          <StyledExpandIcon
            fill="black"
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
  margin-left: 24px;
`;

const StyledExpandIcon = styled(IconPlay)<{collapsed: boolean}>`
  rotate: 90deg;
  ${p =>
    p.collapsed &&
    `
    rotate: 0deg;
  `}
`;

export default ViewHierarchy;
