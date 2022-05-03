import React from 'react';
import styled from '@emotion/styled';

import Category from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/category';
import Time from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/time';
import Type from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type';
import {transformCrumbs} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {
  Panel as BasePanel,
  PanelBody as BasePanelBody,
  PanelHeader as BasePanelHeader,
  PanelItem,
} from 'sentry/components/panels';
import space from 'sentry/styles/space';
import {RawCrumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';

type Props = {
  crumbs: RawCrumb[];
  event: Event | undefined;
};

function UserActionsNavigator({event, crumbs}: Props) {
  if (!event) {
    return null;
  }

  const transformedCrumbs = transformCrumbs(crumbs);

  return (
    <Panel>
      <PanelHeader>Event Chapters</PanelHeader>

      <PanelBody>
        <div>
          {transformedCrumbs.map(item => (
            <PanelItemCenter key={item.id}>
              <Wrapper>
                <Type
                  type={item.type}
                  color={item.color}
                  description={item.description}
                />
                <Category category={item.category} searchTerm="" />
              </Wrapper>
              {/* Probably we need to use or create another component to show the timestamp relative */}
              <Time
                timestamp={event.dateReceived}
                relativeTime={item.timestamp}
                searchTerm=""
              />
            </PanelItemCenter>
          ))}
        </div>
      </PanelBody>
    </Panel>
  );
}

export default UserActionsNavigator;

const Panel = styled(BasePanel)`
  width: 100%;
  display: grid;
  height: 0;
  min-height: 100%;
  margin-bottom: 0;
`;

const PanelHeader = styled(BasePanelHeader)`
  background-color: #fff;
  border-bottom: none;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  text-transform: capitalize;
  padding: ${space(1.5)} ${space(2)} ${space(0.5)};
`;

const PanelBody = styled(BasePanelBody)`
  overflow-y: auto;
`;

const PanelItemCenter = styled(PanelItem)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: none;
  padding: ${space(1)} ${space(1.5)};
`;

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray500};
`;
