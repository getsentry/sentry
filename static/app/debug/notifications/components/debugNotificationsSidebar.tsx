import {Fragment} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';
import {useRegistry} from 'sentry/debug/notifications/hooks/useRegistry';
import {useLocation} from 'sentry/utils/useLocation';

export function DebugNotificationsSidebar() {
  const location = useLocation();
  const {data: registry = {}} = useRegistry();
  return (
    <Flex direction="column" gap="xl" padding="xl 0">
      {Object.entries(registry).map(([category, registrations], i) => (
        <Fragment key={category}>
          {i !== 0 && <CategoryDivider />}
          <Container padding="md">
            <Container padding="md">
              <Heading as="h3" size="md">
                {category}
              </Heading>
            </Container>
            <SourceList>
              {registrations.map(registration => (
                <Container key={registration.source} as="li">
                  <NotificationLinkButton
                    borderless
                    active={location.query.source === registration.source}
                    to={
                      location.query.source === registration.source
                        ? {query: {...location.query, source: undefined}}
                        : {query: {...location.query, source: registration.source}}
                    }
                  >
                    {registration.source}
                  </NotificationLinkButton>
                </Container>
              ))}
            </SourceList>
          </Container>
        </Fragment>
      ))}
    </Flex>
  );
}

const CategoryDivider = styled('hr')`
  margin: 0 auto;
  border-color: ${p => p.theme.tokens.border.muted};
  width: calc(100% - ${p => p.theme.space.xl});
`;

const SourceList = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const NotificationLinkButton = styled(LinkButton, {
  shouldForwardProp: prop => prop !== 'active',
})<{active: boolean}>`
  padding: ${p => p.theme.space.md};
  position: relative;
  display: block;
  color: ${p =>
    p.active ? p.theme.tokens.content.success : p.theme.tokens.content.muted};
  font-weight: ${p => p.theme.fontWeight.normal};
  text-align: left;
  /* Undo some button styles */
  height: auto;
  min-height: auto;
  > span {
    justify-content: flex-start;
    white-space: normal;
  }
  /* Dark notch beside active sources */
  &:after {
    content: '';
    position: absolute;
    left: -9px;
    height: 20px;
    width: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: ${p => p.theme.tokens.graphics.success};
    border-radius: ${p => p.theme.borderRadius};
    opacity: ${p => (p.active ? 1 : 0)};
  }
  &:hover {
    color: ${p =>
      p.active ? p.theme.tokens.content.success : p.theme.tokens.content.primary};
    &:before {
      background: ${p => (p.active ? p.theme.green100 : p.theme.gray100)};
      opacity: 1;
    }
  }
  &:active {
    color: ${p =>
      p.active ? p.theme.tokens.content.success : p.theme.tokens.content.primary};
    &:before {
      background: ${p => (p.active ? p.theme.green200 : p.theme.gray200)};
      opacity: 1;
    }
  }
`;
