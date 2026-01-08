import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Disclosure} from 'sentry/components/core/disclosure';
import {Heading} from 'sentry/components/core/text';

export function DebugNotificationsPreview({
  title,
  children,
  actions = null,
}: {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}) {
  return (
    <Fragment>
      <PreviewDisclosure defaultExpanded>
        <Disclosure.Title trailingItems={actions}>
          <Heading as="h2">{title}</Heading>
        </Disclosure.Title>
        <Disclosure.Content>{children}</Disclosure.Content>
      </PreviewDisclosure>
      <Divider />
    </Fragment>
  );
}

const PreviewDisclosure = styled(Disclosure)`
  pre,
  code {
    white-space: pre-wrap;
  }
`;

const Divider = styled('hr')`
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  width: 100%;
  &:last-child {
    display: none;
  }
`;
