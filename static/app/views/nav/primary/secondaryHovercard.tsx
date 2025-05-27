import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {useNavContext} from 'sentry/views/nav/context';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {SecondaryNavContent} from 'sentry/views/nav/secondary/secondaryNavContent';
import type {PrimaryNavGroup} from 'sentry/views/nav/types';
import {NavLayout} from 'sentry/views/nav/types';

interface SecondaryHovercardProps {
  children: React.ReactNode;
  group: PrimaryNavGroup;
}

export function SecondaryHovercard({children, group}: SecondaryHovercardProps) {
  const {layout, isCollapsed, navParentRef} = useNavContext();

  if (layout !== NavLayout.SIDEBAR || !isCollapsed) {
    return children;
  }

  return (
    <ClassNames>
      {({css}) => (
        <Hovercard
          body={
            <IconDefaultsProvider>
              <SecondaryBody>
                <SecondaryNavContent group={group} />
              </SecondaryBody>
            </IconDefaultsProvider>
          }
          position="right-start"
          animated={false}
          delay={50}
          displayTimeout={50}
          bodyClassName={css`
            padding: 0;
            max-height: 80vh;
            display: grid;
            grid-template-rows: auto 1fr auto;
          `}
          containerDisplayMode="block"
          offset={0}
          portalContainer={navParentRef.current ?? undefined}
        >
          {children}
        </Hovercard>
      )}
    </ClassNames>
  );
}

const SecondaryBody = styled(SecondaryNav)`
  display: contents;
`;
