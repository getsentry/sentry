import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';

export function FieldGroup({
  title,
  children,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) {
      return undefined;
    }

    const fieldName = decodeURIComponent(hash.slice(1));
    if (!fieldName) {
      return undefined;
    }

    const rafId = requestAnimationFrame(() => {
      document
        .getElementById(fieldName)
        ?.scrollIntoView({block: 'center', behavior: 'smooth'});
    });

    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <Panel>
      <PanelHeader>{title}</PanelHeader>
      <PanelBody>{children}</PanelBody>
    </Panel>
  );
}

const PanelBody = styled(Container)`
  > * {
    padding: ${p => p.theme.space.xl};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

    &:last-child {
      border-bottom: none;
    }
  }
`;
